import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { WebhookSignatureService } from '../webhooks/webhook-signature.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

export interface ApiKeyCreateResult {
  id: string;
  name: string;
  keyPrefix: string;
  rawKey: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
    private readonly signatureService: WebhookSignatureService,
  ) {}

  async createKey(
    organizationId: string,
    dto: CreateApiKeyDto,
    actorUserId: string,
  ): Promise<ApiKeyCreateResult> {
    const { rawKey, hash, prefix } = this.signatureService.generateApiKey();

    const existing = await this.prisma.apiKey.findUnique({
      where: {
        organizationId_keyPrefix: { organizationId, keyPrefix: prefix },
      },
    });
    if (existing) {
      throw new ConflictException('API key prefix collision. Please retry.');
    }

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId,
        createdByUserId: actorUserId,
        name: dto.name,
        description: dto.description,
        keyPrefix: prefix,
        sha256Hash: hash,
        scopes: dto.scopes ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.audit.record({
      eventName: 'API_KEY_CREATED',
      action: 'API_KEY_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'api_key',
      resourceId: apiKey.id,
      details: { name: dto.name, prefix, scopes: dto.scopes },
    });

    this.logger.log({
      level: 'INFO',
      message: 'API key created',
      module: 'Integrations',
      event: 'API_KEY_CREATED',
      organizationId,
      keyId: apiKey.id,
      prefix,
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      rawKey,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  async listKeys(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId, revokedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeKey(
    organizationId: string,
    keyId: string,
    actorUserId: string,
    reason?: string,
  ) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, organizationId, revokedAt: null },
    });
    if (!key)
      throw new NotFoundException(
        `API key '${keyId}' not found or already revoked`,
      );

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: {
        revokedAt: new Date(),
        revokedReason: reason ?? 'Revoked by user',
      },
    });

    await this.audit.record({
      eventName: 'API_KEY_REVOKED',
      action: 'API_KEY_REVOKED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'api_key',
      resourceId: keyId,
      details: { reason },
    });

    this.logger.log({
      level: 'INFO',
      message: 'API key revoked',
      module: 'Integrations',
      event: 'API_KEY_REVOKED',
      organizationId,
      keyId,
    });

    return { success: true };
  }

  async validateKey(rawKey: string): Promise<{
    organizationId: string;
    scopes: string[];
    keyId: string;
  } | null> {
    const hash = this.signatureService.hashApiKey(rawKey);
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        sha256Hash: hash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!apiKey) return null;

    void this.prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return {
      organizationId: apiKey.organizationId,
      scopes: apiKey.scopes,
      keyId: apiKey.id,
    };
  }
}
