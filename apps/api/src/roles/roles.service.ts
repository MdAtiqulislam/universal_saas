import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const PROTECTED_SYSTEM_ROLES = ['OWNER', 'ADMIN', 'VIEWER'];

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all available roles for an organization (global system roles + tenant custom roles).
   */
  async listRoles(organizationId: string) {
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [{ organizationId: null, isSystem: true }, { organizationId }],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      organizationId: r.organizationId,
      permissions: r.rolePermissions.map((rp) => rp.permission.name),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Get role details by ID.
   */
  async getRole(roleId: string, organizationId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ organizationId: null, isSystem: true }, { organizationId }],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      organizationId: role.organizationId,
      permissions: role.rolePermissions.map((rp) => rp.permission.name),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * Create a new custom role within the organization.
   */
  async createCustomRole(
    dto: CreateRoleDto,
    organizationId: string,
    actorUserId?: string,
  ) {
    const normalizedName = dto.name.trim().toUpperCase();

    // Check system role name hijacking
    if (PROTECTED_SYSTEM_ROLES.includes(normalizedName)) {
      throw new ConflictException(
        `Cannot create custom role with protected system role name: ${normalizedName}`,
      );
    }

    // Check duplicate role name in this organization
    const existing = await this.prisma.role.findFirst({
      where: {
        name: normalizedName,
        organizationId,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A role with this name already exists in the organization',
      );
    }

    // Validate permissions if provided
    let permissionRecords: { id: string; name: string }[] = [];
    if (dto.permissions && dto.permissions.length > 0) {
      permissionRecords = await this.prisma.permission.findMany({
        where: {
          name: { in: dto.permissions },
        },
      });

      if (permissionRecords.length !== dto.permissions.length) {
        const foundNames = new Set(permissionRecords.map((p) => p.name));
        const missing = dto.permissions.filter((p) => !foundNames.has(p));
        throw new BadRequestException(
          `Unknown permissions specified: ${missing.join(', ')}`,
        );
      }
    }

    try {
      const createdRole = await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.create({
          data: {
            name: normalizedName,
            description: dto.description?.trim() ?? null,
            isSystem: false,
            organizationId,
          },
        });

        if (permissionRecords.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionRecords.map((p) => ({
              roleId: role.id,
              permissionId: p.id,
            })),
          });
        }

        return role;
      });

      const roleResult = await this.getRole(createdRole.id, organizationId);

      // Publish audit event
      await this.eventBus.publish({
        eventName: 'ROLE_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'role.create',
        resource: 'role',
        resourceId: createdRole.id,
        details: {
          name: roleResult.name,
          permissions: roleResult.permissions,
        },
      });

      return roleResult;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A role with this name already exists in the organization',
        );
      }
      throw error;
    }
  }

  /**
   * Update a custom role within the organization.
   */
  async updateCustomRole(
    roleId: string,
    dto: UpdateRoleDto,
    organizationId: string,
    actorUserId?: string,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified');
    }

    if (role.organizationId !== organizationId) {
      throw new NotFoundException('Role not found in this organization');
    }

    let updatedName = role.name;
    if (dto.name) {
      const normalizedName = dto.name.trim().toUpperCase();
      if (PROTECTED_SYSTEM_ROLES.includes(normalizedName)) {
        throw new ConflictException(
          `Cannot rename role to protected system role name: ${normalizedName}`,
        );
      }

      if (normalizedName !== role.name) {
        const existing = await this.prisma.role.findFirst({
          where: {
            name: normalizedName,
            organizationId,
          },
        });

        if (existing && existing.id !== roleId) {
          throw new ConflictException(
            'A role with this name already exists in the organization',
          );
        }
        updatedName = normalizedName;
      }
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: updatedName,
        description:
          dto.description !== undefined
            ? (dto.description?.trim() ?? null)
            : undefined,
      },
    });

    const updatedRole = await this.getRole(roleId, organizationId);

    // Publish audit event
    await this.eventBus.publish({
      eventName: 'ROLE_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'role.update',
      resource: 'role',
      resourceId: roleId,
      details: {
        previousName: role.name,
        newName: updatedRole.name,
      },
    });

    return updatedRole;
  }

  /**
   * Delete a custom role from the organization.
   */
  async deleteCustomRole(
    roleId: string,
    organizationId: string,
    actorUserId?: string,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    if (role.organizationId !== organizationId) {
      throw new NotFoundException('Role not found in this organization');
    }

    // Check if role is assigned to any members
    const assignedCount = await this.prisma.memberRole.count({
      where: { roleId },
    });

    if (assignedCount > 0) {
      throw new ConflictException(
        'Cannot delete role currently assigned to organization members',
      );
    }

    await this.prisma.role.delete({
      where: { id: roleId },
    });

    // Publish audit event
    await this.eventBus.publish({
      eventName: 'ROLE_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'role.delete',
      resource: 'role',
      resourceId: roleId,
      details: {
        name: role.name,
      },
    });

    return {
      success: true,
      message: 'Custom role deleted successfully',
    };
  }

  /**
   * Atomically update/replace permissions assigned to a role.
   */
  async updateRolePermissions(
    roleId: string,
    permissions: string[],
    organizationId: string,
    actorUserId?: string,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new ForbiddenException(
        'System role permissions cannot be modified',
      );
    }

    if (role.organizationId !== organizationId) {
      throw new NotFoundException('Role not found in this organization');
    }

    const uniquePermissions = Array.from(new Set(permissions));

    // Validate permission records
    const permissionRecords = await this.prisma.permission.findMany({
      where: {
        name: { in: uniquePermissions },
      },
    });

    if (permissionRecords.length !== uniquePermissions.length) {
      const foundNames = new Set(permissionRecords.map((p) => p.name));
      const missing = uniquePermissions.filter((p) => !foundNames.has(p));
      throw new BadRequestException(
        `Unknown permissions specified: ${missing.join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove current permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Insert new permissions
      if (permissionRecords.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionRecords.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        });
      }
    });

    const updatedRole = await this.getRole(roleId, organizationId);

    // Publish audit event
    await this.eventBus.publish({
      eventName: 'ROLE_PERMISSIONS_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'role.permissions_update',
      resource: 'role',
      resourceId: roleId,
      details: {
        permissions: updatedRole.permissions,
      },
    });

    return updatedRole;
  }

  /**
   * List roles assigned to a member. Scoped by organizationId + memberId.
   */
  async listMemberRoles(organizationId: string, memberId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
        deletedAt: null,
      },
      include: {
        memberRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    return member.memberRoles.map((mr) => ({
      id: mr.role.id,
      name: mr.role.name,
      description: mr.role.description,
      isSystem: mr.role.isSystem,
      organizationId: mr.role.organizationId,
      permissions: mr.role.rolePermissions.map((rp) => rp.permission.name),
    }));
  }

  /**
   * Assign a role to an organization member. Scoped by organizationId + memberId.
   */
  async assignRoleToMember(
    organizationId: string,
    memberId: string,
    roleId: string,
    actorUserId?: string,
  ) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Role must be system role OR belong to this organization
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ organizationId: null, isSystem: true }, { organizationId }],
      },
    });

    if (!role) {
      throw new NotFoundException(
        'Role not found or invalid for this organization',
      );
    }

    const memberRole = await this.prisma.memberRole.upsert({
      where: {
        memberId_roleId: {
          memberId,
          roleId,
        },
      },
      update: {},
      create: {
        memberId,
        roleId,
      },
      include: {
        role: true,
      },
    });

    // Publish audit event
    await this.eventBus.publish({
      eventName: 'MEMBER_ROLE_ASSIGNED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'member.role_assign',
      resource: 'organization_member',
      resourceId: memberId,
      details: {
        roleId,
        roleName: role.name,
      },
    });

    return {
      memberId: memberRole.memberId,
      roleId: memberRole.roleId,
      role: {
        id: memberRole.role.id,
        name: memberRole.role.name,
        isSystem: memberRole.role.isSystem,
      },
    };
  }

  /**
   * Remove a role from an organization member.
   * Includes OWNER protection.
   */
  async removeRoleFromMember(
    organizationId: string,
    memberId: string,
    roleId: string,
    actorUserId?: string,
  ) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Owner Protection: Check if removing OWNER from the last active owner
    if (role.name === 'OWNER' && role.isSystem) {
      const otherOwnersCount = await this.prisma.memberRole.count({
        where: {
          memberId: { not: memberId },
          member: {
            organizationId,
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
          'Operation prohibited: Cannot remove the last OWNER role from the organization',
        );
      }
    }

    await this.prisma.memberRole.deleteMany({
      where: {
        memberId,
        roleId,
      },
    });

    // Publish audit event
    await this.eventBus.publish({
      eventName: 'MEMBER_ROLE_REMOVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'member.role_remove',
      resource: 'organization_member',
      resourceId: memberId,
      details: {
        roleId,
        roleName: role.name,
      },
    });

    return {
      success: true,
      message: 'Role removed from member successfully',
    };
  }
}
