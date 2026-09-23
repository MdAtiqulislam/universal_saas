import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthorizationService } from '../authorization.service';
import { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

interface RequestWithTenantContext {
  user?: { id: string; sessionId: string };
  tenantContext?: TenantContext;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithTenantContext>();

    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const organizationId = request.tenantContext?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException(
        'Tenant context required for permission evaluation',
      );
    }

    const hasAccess = await this.authorizationService.hasPermissions(
      userId,
      organizationId,
      requiredPermissions,
    );

    if (!hasAccess) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
