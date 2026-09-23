import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { ApiKeysService } from '../../integrations/api-keys/api-keys.service';
import { WebhookSignatureService } from '../../integrations/webhooks/webhook-signature.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityEventsService } from '../../security/events/security-events.service';

describe('ApiKeyAuthGuard (M41)', () => {
  let guard: ApiKeyAuthGuard;
  let findFirstMock: jest.Mock;
  let updateMock: jest.Mock;
  let logEventMock: jest.Mock;

  beforeEach(() => {
    findFirstMock = jest.fn();
    updateMock = jest.fn().mockResolvedValue({});
    logEventMock = jest.fn().mockResolvedValue(undefined);

    const apiKeysService = {} as unknown as ApiKeysService;
    const signatureService = {
      hashApiKey: jest.fn().mockImplementation((k: string) => `hash_${k}`),
    } as unknown as WebhookSignatureService;
    const prisma = {
      apiKey: {
        findFirst: findFirstMock,
        update: updateMock,
      },
    } as unknown as PrismaService;
    const securityEvents = {
      logEvent: logEventMock,
    } as unknown as SecurityEventsService;

    guard = new ApiKeyAuthGuard(
      apiKeysService,
      signatureService,
      prisma,
      securityEvents,
    );
  });

  const createMockContext = (
    headers: Record<string, string>,
  ): ExecutionContext => {
    const request: Record<string, unknown> = {
      headers,
      method: 'GET',
      url: '/api/v1/crm/leads',
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    const ctx = createMockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when Authorization header format is invalid', async () => {
    const ctx = createMockContext({ authorization: 'Basic user:pass' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when API key is not found in database', async () => {
    findFirstMock.mockResolvedValue(null);
    const ctx = createMockContext({ authorization: 'Bearer invalid-key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(logEventMock).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when API key is revoked (INV-413)', async () => {
    findFirstMock.mockResolvedValue({
      id: 'key-1',
      organizationId: 'org-1',
      revokedAt: new Date(),
      keyPrefix: 'prefix12',
    });
    const ctx = createMockContext({ authorization: 'Bearer revoked-key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'API key has been revoked',
    );
  });

  it('should throw UnauthorizedException when API key is expired (INV-414)', async () => {
    findFirstMock.mockResolvedValue({
      id: 'key-1',
      organizationId: 'org-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
      keyPrefix: 'prefix12',
    });
    const ctx = createMockContext({ authorization: 'Bearer expired-key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow('API key has expired');
  });

  it('should throw ForbiddenException on cross-tenant header mismatch (INV-416)', async () => {
    findFirstMock.mockResolvedValue({
      id: 'key-1',
      organizationId: 'org-original',
      revokedAt: null,
      expiresAt: null,
      keyPrefix: 'prefix12',
      scopes: ['api.admin'],
    });
    const ctx = createMockContext({
      authorization: 'Bearer valid-key',
      'x-organization-id': 'org-attacker',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(logEventMock).toHaveBeenCalledWith(
      'org-original',
      expect.objectContaining({ eventType: 'CROSS_TENANT_API_BREACH_ATTEMPT' }),
    );
  });

  it('should allow active key and bind tenantContext & apiKey to request', async () => {
    const keyRecord = {
      id: 'key-1',
      organizationId: 'org-tenant-1',
      name: 'Integration Key',
      keyPrefix: 'prefix12',
      scopes: ['crm.read', 'accounting.read'],
      revokedAt: null,
      expiresAt: null,
      createdByUserId: 'user-creator',
    };
    findFirstMock.mockResolvedValue(keyRecord);

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid-key' },
      method: 'GET',
      url: '/api/v1/crm/leads',
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const allowed = await guard.canActivate(ctx);
    expect(allowed).toBe(true);
    expect(request.apiKey).toBeDefined();
    const apiKey = request.apiKey as { id: string; organizationId: string };
    const tenantCtx = request.tenantContext as { organizationId: string };
    expect(apiKey.id).toBe('key-1');
    expect(apiKey.organizationId).toBe('org-tenant-1');
    expect(tenantCtx.organizationId).toBe('org-tenant-1');
  });
});
