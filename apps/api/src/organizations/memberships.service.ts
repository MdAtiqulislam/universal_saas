import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

export interface SanitizedMember {
  id: string;
  organizationId: string;
  userId: string;
  status: string;
  user: {
    id: string;
    email: string;
    status: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all members of an organization.
   */
  async listMembers(
    orgId: string,
    requesterUserId: string,
  ): Promise<SanitizedMember[]> {
    await this.validateMembership(orgId, requesterUserId);

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return members.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      userId: m.userId,
      status: m.status,
      user: {
        id: m.user.id,
        email: m.user.email,
        status: m.user.status,
      },
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  /**
   * Add/Invite a user to the organization.
   */
  async addMember(
    orgId: string,
    dto: CreateMemberDto,
    requesterUserId: string,
  ): Promise<SanitizedMember> {
    await this.validateMembership(orgId, requesterUserId);

    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Find global user by email
    const targetUser = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        deletedAt: null,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User with specified email not found');
    }

    if (targetUser.status !== 'ACTIVE') {
      throw new ForbiddenException('Cannot invite inactive or suspended user');
    }

    // 2. Check existing membership in this organization
    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: targetUser.id,
        },
      },
    });

    let memberRecord: {
      id: string;
      organizationId: string;
      userId: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      user: { id: string; email: string; status: string };
    };

    if (existing) {
      if (existing.deletedAt === null && existing.status === 'ACTIVE') {
        throw new ConflictException(
          'User is already an active member of this organization',
        );
      }

      // Reactivate or re-invite
      const updated = await this.prisma.organizationMember.update({
        where: { id: existing.id },
        data: {
          status: 'INVITED',
          deletedAt: null,
        },
        include: {
          user: true,
        },
      });

      memberRecord = updated;
    } else {
      // 3. Create new membership
      const created = await this.prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: targetUser.id,
          status: 'INVITED',
        },
        include: {
          user: true,
        },
      });

      memberRecord = created;
    }

    // Publish audit event
    await this.eventBus.publish({
      eventName: 'MEMBER_INVITED',
      occurredAt: new Date(),
      organizationId: orgId,
      actorUserId: requesterUserId,
      action: 'member.invite',
      resource: 'organization_member',
      resourceId: memberRecord.id,
      details: {
        invitedUserId: targetUser.id,
        invitedEmail: targetUser.email,
        status: memberRecord.status,
      },
    });

    return {
      id: memberRecord.id,
      organizationId: memberRecord.organizationId,
      userId: memberRecord.userId,
      status: memberRecord.status,
      user: {
        id: memberRecord.user.id,
        email: memberRecord.user.email,
        status: memberRecord.user.status,
      },
      createdAt: memberRecord.createdAt,
      updatedAt: memberRecord.updatedAt,
    };
  }

  /**
   * Update membership status. Scoped by organizationId + memberId to prevent cross-tenant IDOR.
   */
  async updateMember(
    orgId: string,
    memberId: string,
    dto: UpdateMemberDto,
    requesterUserId: string,
  ): Promise<SanitizedMember> {
    await this.validateMembership(orgId, requesterUserId);

    // Scoped query to prevent IDOR
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Owner Protection: Prevent suspending the last active OWNER
    if (dto.status === 'SUSPENDED') {
      await this.ensureNotLastOwner(orgId, member.id);
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: member.id },
      data: { status: dto.status },
      include: { user: true },
    });

    // Publish audit event
    await this.eventBus.publish({
      eventName: 'MEMBER_STATUS_CHANGED',
      occurredAt: new Date(),
      organizationId: orgId,
      actorUserId: requesterUserId,
      action: 'member.status_change',
      resource: 'organization_member',
      resourceId: member.id,
      details: {
        previousStatus: member.status,
        newStatus: updated.status,
        targetUserId: updated.userId,
      },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      userId: updated.userId,
      status: updated.status,
      user: {
        id: updated.user.id,
        email: updated.user.email,
        status: updated.user.status,
      },
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Soft-delete / Remove a member from the organization.
   */
  async removeMember(
    orgId: string,
    memberId: string,
    requesterUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.validateMembership(orgId, requesterUserId);

    // Scoped query to prevent IDOR
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Owner Protection: Prevent deleting the last active OWNER
    await this.ensureNotLastOwner(orgId, member.id);

    await this.prisma.organizationMember.update({
      where: { id: member.id },
      data: {
        deletedAt: new Date(),
        status: 'SUSPENDED',
      },
    });

    // Publish audit event
    await this.eventBus.publish({
      eventName: 'MEMBER_REMOVED',
      occurredAt: new Date(),
      organizationId: orgId,
      actorUserId: requesterUserId,
      action: 'member.remove',
      resource: 'organization_member',
      resourceId: member.id,
      details: {
        targetUserId: member.userId,
      },
    });

    return {
      success: true,
      message: 'Member removed from organization successfully',
    };
  }

  /**
   * Validate that requester is an active member of the organization.
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

  /**
   * Owner Protection: Ensures an organization cannot be left without an active OWNER.
   */
  private async ensureNotLastOwner(
    orgId: string,
    memberId: string,
  ): Promise<void> {
    const memberOwnerRole = await this.prisma.memberRole.findFirst({
      where: {
        memberId,
        role: {
          name: 'OWNER',
          organizationId: null,
          isSystem: true,
        },
      },
    });

    if (memberOwnerRole) {
      const otherOwnersCount = await this.prisma.memberRole.count({
        where: {
          memberId: { not: memberId },
          member: {
            organizationId: orgId,
            status: 'ACTIVE',
            deletedAt: null,
          },
          role: {
            name: 'OWNER',
            organizationId: null,
            isSystem: true,
          },
        },
      });

      if (otherOwnersCount === 0) {
        throw new ForbiddenException(
          'Operation prohibited: Cannot remove or suspend the last active OWNER of the organization',
        );
      }
    }
  }
}
