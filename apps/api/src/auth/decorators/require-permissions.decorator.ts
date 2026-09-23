import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to declare required permissions on a route handler or controller.
 * Evaluated with AND semantics by PermissionGuard.
 * Example: @RequirePermissions('users.view', 'users.manage')
 */
export const RequirePermissions = (
  ...permissions: string[]
): CustomDecorator<string> => SetMetadata(PERMISSIONS_KEY, permissions);
