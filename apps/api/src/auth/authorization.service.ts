import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve all effective permissions for a user within a specific organization.
   * Resolves both global system roles and organization-scoped custom roles.
   */
  async getEffectivePermissions(
    userId: string,
    organizationId: string,
  ): Promise<string[]> {
    if (!userId || !organizationId) {
      return [];
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        organization: true,
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

    if (
      !membership ||
      membership.deletedAt !== null ||
      membership.status !== 'ACTIVE' ||
      membership.organization.deletedAt !== null ||
      membership.organization.status !== 'ACTIVE'
    ) {
      return [];
    }

    const permissionsSet = new Set<string>();

    for (const memberRole of membership.memberRoles) {
      const role = memberRole.role;

      // Allow global system roles OR roles explicitly belonging to this organization
      const isSystemRole = role.isSystem && role.organizationId === null;
      const isTenantRole = role.organizationId === organizationId;

      if (isSystemRole || isTenantRole) {
        for (const rolePerm of role.rolePermissions) {
          if (rolePerm.permission?.name) {
            permissionsSet.add(rolePerm.permission.name);
          }
        }
      }
    }

    return Array.from(permissionsSet);
  }

  /**
   * Check if a user has a specific permission within an organization.
   */
  async hasPermission(
    userId: string,
    organizationId: string,
    permission: string,
  ): Promise<boolean> {
    const effectivePermissions = await this.getEffectivePermissions(
      userId,
      organizationId,
    );
    return effectivePermissions.includes(permission);
  }

  /**
   * Check if a user has ALL of the specified permissions (AND semantics) within an organization.
   */
  async hasPermissions(
    userId: string,
    organizationId: string,
    requiredPermissions: string[],
  ): Promise<boolean> {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const effectivePermissions = await this.getEffectivePermissions(
      userId,
      organizationId,
    );
    const permissionsSet = new Set(effectivePermissions);

    for (const perm of requiredPermissions) {
      if (!permissionsSet.has(perm)) {
        return false;
      }
    }

    return true;
  }
}
