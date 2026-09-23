import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

export interface SanitizedOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new organization with settings, initial active member, and OWNER role in a single transaction.
   */
  async create(
    dto: CreateOrganizationDto,
    userId: string,
  ): Promise<SanitizedOrganization> {
    const normalizedSlug = dto.slug.trim().toLowerCase();

    // Check slug availability
    const existing = await this.prisma.organization.findUnique({
      where: { slug: normalizedSlug },
    });

    if (existing) {
      throw new ConflictException('Organization slug is already in use');
    }

    try {
      const createdOrg = await this.prisma.$transaction(async (tx) => {
        // 1. Create Organization
        const org = await tx.organization.create({
          data: {
            name: dto.name.trim(),
            slug: normalizedSlug,
            status: 'ACTIVE',
          },
        });

        // 2. Create Default Organization Settings
        await tx.organizationSetting.create({
          data: {
            organizationId: org.id,
            currency: 'USD',
            timezone: 'UTC',
            fiscalYearStart: 1,
          },
        });

        // 3. Create Initial Active Member (Authenticated Creator)
        const member = await tx.organizationMember.create({
          data: {
            organizationId: org.id,
            userId,
            status: 'ACTIVE',
          },
        });

        // 4. Find System OWNER Role
        let ownerRole = await tx.role.findFirst({
          where: {
            name: 'OWNER',
            organizationId: null,
            isSystem: true,
          },
        });

        if (!ownerRole) {
          // Fallback creation of system OWNER role if not present
          ownerRole = await tx.role.create({
            data: {
              name: 'OWNER',
              description:
                'Organization Owner with complete administrative authority',
              isSystem: true,
              organizationId: null,
            },
          });
        }

        // 5. Assign OWNER Role to Member
        await tx.memberRole.create({
          data: {
            memberId: member.id,
            roleId: ownerRole.id,
          },
        });

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        };
      });

      // Publish audit event
      await this.eventBus.publish({
        eventName: 'ORGANIZATION_CREATED',
        occurredAt: new Date(),
        organizationId: createdOrg.id,
        actorUserId: userId,
        action: 'organization.create',
        resource: 'organization',
        resourceId: createdOrg.id,
        details: {
          name: createdOrg.name,
          slug: createdOrg.slug,
        },
      });

      return createdOrg;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Organization slug is already in use');
      }
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to create organization transaction', errMsg);
      throw error;
    }
  }

  /**
   * List all active organizations where the user has an active membership.
   */
  async listUserOrganizations(
    userId: string,
  ): Promise<SanitizedOrganization[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
        organization: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      status: m.organization.status,
      createdAt: m.organization.createdAt,
      updatedAt: m.organization.updatedAt,
    }));
  }

  /**
   * Retrieve an organization by ID with membership validation.
   */
  async getOrganization(
    orgId: string,
    userId: string,
  ): Promise<SanitizedOrganization> {
    await this.validateMembership(orgId, userId);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.deletedAt !== null || org.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Organization is archived, suspended, or inactive',
      );
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  /**
   * Update an organization's profile (name and/or slug).
   */
  async updateOrganization(
    orgId: string,
    dto: UpdateOrganizationDto,
    userId: string,
  ): Promise<SanitizedOrganization> {
    await this.validateMembership(orgId, userId);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.deletedAt !== null || org.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Organization is archived, suspended, or inactive',
      );
    }

    // Check slug conflict if slug is being modified
    if (dto.slug && dto.slug.trim().toLowerCase() !== org.slug) {
      const normalizedSlug = dto.slug.trim().toLowerCase();
      const existingSlug = await this.prisma.organization.findUnique({
        where: { slug: normalizedSlug },
      });

      if (existingSlug && existingSlug.id !== orgId) {
        throw new ConflictException('Organization slug is already in use');
      }
    }

    try {
      const updated = await this.prisma.organization.update({
        where: { id: orgId },
        data: {
          name: dto.name?.trim(),
          slug: dto.slug?.trim().toLowerCase(),
        },
      });

      // Publish audit event
      await this.eventBus.publish({
        eventName: 'ORGANIZATION_UPDATED',
        occurredAt: new Date(),
        organizationId: orgId,
        actorUserId: userId,
        action: 'organization.update',
        resource: 'organization',
        resourceId: orgId,
        details: {
          previousName: org.name,
          newName: updated.name,
          previousSlug: org.slug,
          newSlug: updated.slug,
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Organization slug is already in use');
      }
      throw error;
    }
  }

  /**
   * Soft-delete / Archive an organization.
   */
  async softDeleteOrganization(
    orgId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.validateMembership(orgId, userId);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.deletedAt !== null) {
      throw new ForbiddenException('Organization is already archived');
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
      },
    });

    // Publish audit event
    await this.eventBus.publish({
      eventName: 'ORGANIZATION_ARCHIVED',
      occurredAt: new Date(),
      organizationId: orgId,
      actorUserId: userId,
      action: 'organization.archive',
      resource: 'organization',
      resourceId: orgId,
      details: {
        name: org.name,
        slug: org.slug,
      },
    });

    return {
      success: true,
      message: 'Organization archived successfully',
    };
  }

  /**
   * Validate that the user is an active member of the organization.
   */
  private async validateMembership(
    orgId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!member || member.deletedAt !== null || member.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'User is not an active member of this organization',
      );
    }
  }
}
