import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeysService } from '../../integrations/api-keys/api-keys.service';
import { SecurityEventsService } from '../../security/events/security-events.service';
import {
  SecurityEventCategory,
  SecurityEventSeverity,
} from '../../security/dto/security-events.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookSignatureService } from '../../integrations/webhooks/webhook-signature.service';

export interface ApiKeyContext {
  id: string;
  organizationId: string;
  scopes: string[];
  name?: string;
  keyPrefix: string;
}

interface RequestWithApiKey extends Request {
  apiKey?: ApiKeyContext;
  tenantContext?: {
    organizationId: string;
    membershipId: string;
    userId: string;
  };
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly signatureService: WebhookSignatureService,
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithApiKey>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException(
        'Authentication required: Missing Authorization header',
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedException(
        "Invalid Authorization header format: Must be 'Bearer <api-key>'",
      );
    }

    const rawKey = parts[1].trim();
    if (!rawKey) {
      throw new UnauthorizedException(
        'Missing API key in Authorization header',
      );
    }

    // Hash lookup in database
    const hash = this.signatureService.hashApiKey(rawKey);
    const apiKeyRecord = await this.prisma.apiKey.findFirst({
      where: { sha256Hash: hash },
    });

    if (!apiKeyRecord) {
      void this.securityEvents.logEvent(undefined, {
        category: SecurityEventCategory.AUTHENTICATION,
        eventType: 'API_KEY_INVALID_ATTEMPT',
        severity: SecurityEventSeverity.MEDIUM,
        details: { path: request.url, method: request.method },
      });
      throw new UnauthorizedException('Invalid API key');
    }

    // Check revocation (INV-413)
    if (apiKeyRecord.revokedAt) {
      void this.securityEvents.logEvent(apiKeyRecord.organizationId, {
        category: SecurityEventCategory.AUTHENTICATION,
        eventType: 'API_KEY_REVOKED_ATTEMPT',
        severity: SecurityEventSeverity.HIGH,
        details: {
          keyId: apiKeyRecord.id,
          revokedAt: apiKeyRecord.revokedAt,
          prefix: apiKeyRecord.keyPrefix,
        },
      });
      throw new UnauthorizedException('API key has been revoked');
    }

    // Check expiration (INV-414)
    if (
      apiKeyRecord.expiresAt &&
      apiKeyRecord.expiresAt.getTime() <= Date.now()
    ) {
      void this.securityEvents.logEvent(apiKeyRecord.organizationId, {
        category: SecurityEventCategory.AUTHENTICATION,
        eventType: 'API_KEY_EXPIRED_ATTEMPT',
        severity: SecurityEventSeverity.MEDIUM,
        details: {
          keyId: apiKeyRecord.id,
          expiresAt: apiKeyRecord.expiresAt,
          prefix: apiKeyRecord.keyPrefix,
        },
      });
      throw new UnauthorizedException('API key has expired');
    }

    // Cross-tenant validation (INV-416)
    const headerOrgId =
      request.headers['x-organization-id'] ||
      request.headers['X-Organization-Id'];
    if (
      headerOrgId &&
      typeof headerOrgId === 'string' &&
      headerOrgId.trim().toLowerCase() !==
        apiKeyRecord.organizationId.toLowerCase()
    ) {
      void this.securityEvents.logEvent(apiKeyRecord.organizationId, {
        category: SecurityEventCategory.TENANT_SECURITY,
        eventType: 'CROSS_TENANT_API_BREACH_ATTEMPT',
        severity: SecurityEventSeverity.CRITICAL,
        details: {
          targetOrganizationId: headerOrgId,
          keyId: apiKeyRecord.id,
          prefix: apiKeyRecord.keyPrefix,
        },
      });
      throw new ForbiddenException(
        'Cross-tenant access forbidden: API key cannot access foreign organization resources',
      );
    }

    // Update lastUsedAt timestamp asynchronously
    void this.prisma.apiKey
      .update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    // Bind API Key and Tenant context to request
    request.apiKey = {
      id: apiKeyRecord.id,
      organizationId: apiKeyRecord.organizationId,
      scopes: apiKeyRecord.scopes,
      name: apiKeyRecord.name,
      keyPrefix: apiKeyRecord.keyPrefix,
    };

    request.tenantContext = {
      organizationId: apiKeyRecord.organizationId,
      membershipId: 'api-key-session',
      userId: apiKeyRecord.createdByUserId || 'api-key-actor',
    };

    return true;
  }
}
