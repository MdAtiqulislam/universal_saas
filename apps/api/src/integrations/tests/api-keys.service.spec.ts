import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { WebhookSignatureService } from '../webhooks/webhook-signature.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let prisma: {
    apiKey: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      apiKey: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        WebhookSignatureService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: StructuredLoggingService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
  });

  it('should create an API key and return raw key once', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    prisma.apiKey.create.mockResolvedValue({
      id: 'key-123',
      name: 'Test Key',
      keyPrefix: 'abcd1234',
      scopes: ['integrations.view'],
      expiresAt: null,
      createdAt: new Date(),
    });

    const result = await service.createKey(
      'org-1',
      { name: 'Test Key', scopes: ['integrations.view'] },
      'user-1',
    );

    expect(result.id).toBe('key-123');
    expect(result.rawKey).toHaveLength(64);
    expect(result.keyPrefix).toHaveLength(8);
    expect(prisma.apiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          name: 'Test Key',
          keyPrefix: expect.any(String),
          sha256Hash: expect.any(String),
        }),
      }),
    );
  });

  it('should validate active key and return organizationId', async () => {
    const signatureService = new WebhookSignatureService();
    const rawKey = 'test_raw_key_for_lookup_1234567890';
    const hash = signatureService.hashApiKey(rawKey);

    prisma.apiKey.findFirst.mockResolvedValue({
      id: 'key-123',
      organizationId: 'org-1',
      scopes: ['orders.read'],
      sha256Hash: hash,
    });
    prisma.apiKey.update.mockResolvedValue({});

    const result = await service.validateKey(rawKey);

    expect(result).not.toBeNull();
    expect(result?.organizationId).toBe('org-1');
    expect(result?.scopes).toContain('orders.read');
  });

  it('should return null for non-existent or invalid key', async () => {
    prisma.apiKey.findFirst.mockResolvedValue(null);

    const result = await service.validateKey('invalid_key_string');
    expect(result).toBeNull();
  });
});
