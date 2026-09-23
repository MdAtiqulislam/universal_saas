import { Test, TestingModule } from '@nestjs/testing';
import { QualityConfigService } from './quality-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { InspectionType } from '@prisma/client';

describe('QualityConfigService', () => {
  let service: QualityConfigService;
  let prisma: any;
  let eventBus: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      qualityConfiguration: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      samplingPlan: {
        findFirst: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QualityConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<QualityConfigService>(QualityConfigService);
  });

  it('should return existing quality configuration if present', async () => {
    const mockConfig = {
      id: 'cfg-1',
      organizationId: mockOrgId,
      defaultInspectionType: InspectionType.INCOMING_PURCHASE,
      holdOnFailure: true,
    };
    prisma.qualityConfiguration.findUnique.mockResolvedValue(mockConfig);

    const result = await service.getConfig(mockOrgId);
    expect(result).toEqual(mockConfig);
    expect(prisma.qualityConfiguration.findUnique).toHaveBeenCalledWith({
      where: { organizationId: mockOrgId },
      include: { defaultSamplingPlan: true },
    });
  });

  it('should auto-create default quality config if not found', async () => {
    prisma.qualityConfiguration.findUnique.mockResolvedValue(null);
    const mockCreated = {
      id: 'cfg-new',
      organizationId: mockOrgId,
      defaultInspectionType: InspectionType.INCOMING_PURCHASE,
      holdOnFailure: true,
      requireAllMandatoryCharacteristics: true,
    };
    prisma.qualityConfiguration.create.mockResolvedValue(mockCreated);

    const result = await service.getConfig(mockOrgId);
    expect(result).toEqual(mockCreated);
    expect(prisma.qualityConfiguration.create).toHaveBeenCalled();
  });

  it('should update quality config and publish audit event', async () => {
    const mockUpdated = {
      id: 'cfg-1',
      organizationId: mockOrgId,
      defaultInspectionType: InspectionType.FINISHED_GOODS,
      holdOnFailure: true,
    };
    prisma.qualityConfiguration.upsert.mockResolvedValue(mockUpdated);

    const result = await service.updateConfig(
      mockOrgId,
      { defaultInspectionType: InspectionType.FINISHED_GOODS },
      'user-1',
    );

    expect(result.defaultInspectionType).toBe(InspectionType.FINISHED_GOODS);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'QUALITY_CONFIGURATION_UPDATED',
        organizationId: mockOrgId,
        actorUserId: 'user-1',
      }),
    );
  });
});
