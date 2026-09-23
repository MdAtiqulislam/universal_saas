import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationConnectionsService } from '../connections/integration-connections.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('IntegrationConnectionsService', () => {
  let service: IntegrationConnectionsService;
  let prisma: {
    integrationProvider: { findUnique: jest.Mock };
    integrationConnection: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      integrationProvider: { findUnique: jest.fn() },
      integrationConnection: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationConnectionsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: StructuredLoggingService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<IntegrationConnectionsService>(
      IntegrationConnectionsService,
    );
  });

  it('should create a new connection when provider exists and name is unique', async () => {
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-1',
      name: 'Stripe',
    });
    prisma.integrationConnection.findUnique.mockResolvedValue(null);
    prisma.integrationConnection.create.mockResolvedValue({
      id: 'conn-1',
      organizationId: 'org-1',
      providerId: 'prov-1',
      name: 'Stripe Prod',
      status: 'PENDING',
    });

    const conn = await service.createConnection(
      'org-1',
      { providerId: 'prov-1', name: 'Stripe Prod' },
      'user-1',
    );

    expect(conn.id).toBe('conn-1');
    expect(conn.name).toBe('Stripe Prod');
  });

  it('should reject connection creation when name is duplicate in the same organization', async () => {
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-1',
      name: 'Stripe',
    });
    prisma.integrationConnection.findUnique.mockResolvedValue({
      id: 'existing-conn',
    });

    await expect(
      service.createConnection(
        'org-1',
        { providerId: 'prov-1', name: 'Existing Connection' },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when getting a non-existent connection', async () => {
    prisma.integrationConnection.findFirst.mockResolvedValue(null);

    await expect(service.getConnection('org-1', 'invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
