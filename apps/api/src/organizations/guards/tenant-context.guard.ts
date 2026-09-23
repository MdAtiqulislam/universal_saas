import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../interfaces/tenant-context.interface';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RequestWithContext extends Request {
  user?: { id: string; sessionId: string };
  tenantContext?: TenantContext;
}

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();

    // 1. Ensure user is authenticated
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException(
        'Authentication required before establishing tenant context',
      );
    }

    // 2. Read X-Organization-Id header
    const rawOrgId =
      request.headers['x-organization-id'] ||
      request.headers['X-Organization-Id'];

    if (!rawOrgId || typeof rawOrgId !== 'string' || !rawOrgId.trim()) {
      throw new BadRequestException('X-Organization-Id header is required');
    }

    const organizationId = rawOrgId.trim();

    // 3. Validate UUID format
    if (!UUID_REGEX.test(organizationId)) {
      throw new BadRequestException('Invalid organization ID format');
    }

    // 4. Resolve Organization
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.deletedAt !== null || organization.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Organization is archived, suspended, or inactive',
      );
    }

    // 5. Resolve Membership
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'User is not a member of the requested organization',
      );
    }

    if (membership.deletedAt !== null) {
      throw new ForbiddenException(
        'Organization membership has been deleted or revoked',
      );
    }

    if (membership.status === 'INVITED') {
      throw new ForbiddenException(
        'Organization membership is pending invitation acceptance',
      );
    }

    if (membership.status === 'SUSPENDED') {
      throw new ForbiddenException('Organization membership is suspended');
    }

    if (membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Inactive organization membership');
    }

    // 6. Attach validated tenant context
    request.tenantContext = {
      organizationId: organization.id,
      membershipId: membership.id,
      userId,
    };

    return true;
  }
}
