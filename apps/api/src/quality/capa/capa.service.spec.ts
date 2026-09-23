import { Test, TestingModule } from '@nestjs/testing';
import { CapaService } from './capa.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CapaStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('CapaService', () => {
  let service: CapaService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      nonConformance: { findFirst: jest.fn() },
      cAPA: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'CAPA-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapaService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<CapaService>(CapaService);
  });

  it('should create CAPA correctly and publish audit event', async () => {
    prisma.cAPA.create.mockResolvedValue({
      id: 'capa-1',
      organizationId: mockOrgId,
      capaNumber: 'CAPA-000001',
      title: 'Tool recalibration plan',
      status: CapaStatus.OPEN,
    });

    const result = await service.create(
      mockOrgId,
      {
        title: 'Tool recalibration plan',
        description: 'CNC machine drift prevention',
      },
      'user-1',
    );

    expect(result.capaNumber).toBe('CAPA-000001');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CAPA_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should prevent closing unverified CAPA', async () => {
    prisma.cAPA.findFirst.mockResolvedValue({
      id: 'capa-1',
      organizationId: mockOrgId,
      capaNumber: 'CAPA-000001',
      status: CapaStatus.IN_PROGRESS,
    });

    await expect(service.close(mockOrgId, 'capa-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should close verified CAPA successfully', async () => {
    prisma.cAPA.findFirst.mockResolvedValue({
      id: 'capa-1',
      organizationId: mockOrgId,
      capaNumber: 'CAPA-000001',
      status: CapaStatus.VERIFIED,
    });
    prisma.cAPA.update.mockResolvedValue({
      id: 'capa-1',
      organizationId: mockOrgId,
      capaNumber: 'CAPA-000001',
      status: CapaStatus.CLOSED,
    });

    const result = await service.close(mockOrgId, 'capa-1', 'user-1');
    expect(result.status).toBe(CapaStatus.CLOSED);
  });
});
