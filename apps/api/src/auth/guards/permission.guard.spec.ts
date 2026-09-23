import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PermissionGuard } from './permission.guard';
import { AuthorizationService } from '../authorization.service';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflectorMock: {
    getAllAndOverride: jest.Mock;
  };
  let authorizationServiceMock: {
    hasPermissions: jest.Mock;
  };

  const createMockContext = (
    user?: { id: string },
    tenantContext?: { organizationId: string },
  ): ExecutionContext => {
    const req = {
      user,
      tenantContext,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    reflectorMock = {
      getAllAndOverride: jest.fn(),
    };

    authorizationServiceMock = {
      hasPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        { provide: Reflector, useValue: reflectorMock },
        { provide: AuthorizationService, useValue: authorizationServiceMock },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
  });

  it('1. should allow access when no permissions are required on route', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(null);
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('2. should reject with 401 when user is not authenticated', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['users.view']);
    const context = createMockContext(undefined, {
      organizationId: 'org-1111',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('3. should reject with 403 when tenant context is missing', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['users.view']);
    const context = createMockContext({ id: 'user-1111' }, undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('4. should allow access when AuthorizationService grants required permissions', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue([
      'users.view',
      'users.manage',
    ]);
    authorizationServiceMock.hasPermissions.mockResolvedValue(true);

    const context = createMockContext(
      { id: 'user-1111' },
      { organizationId: 'org-1111' },
    );

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(authorizationServiceMock.hasPermissions).toHaveBeenCalledWith(
      'user-1111',
      'org-1111',
      ['users.view', 'users.manage'],
    );
  });

  it('5. should reject with 403 when user lacks any required permission (Deny by Default)', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['users.manage']);
    authorizationServiceMock.hasPermissions.mockResolvedValue(false);

    const context = createMockContext(
      { id: 'user-1111' },
      { organizationId: 'org-1111' },
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });
});
