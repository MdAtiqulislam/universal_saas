import { Test, TestingModule } from '@nestjs/testing';
import { ReturnReasonsService } from './return-reasons.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ReturnReasonsService', () => {
  let service: ReturnReasonsService;
  let prisma: PrismaService;
  let eventBus: EventBusService;

  const mockOrgId = 'org-111';
  const mockUserId = 'user-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnReasonsService,
        {
          provide: PrismaService,
          useValue: {
            returnReason: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: EventBusService,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ReturnReasonsService>(ReturnReasonsService);
    prisma = module.get<PrismaService>(PrismaService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should list return reasons with tenant filter', async () => {
    const mockList = [{ id: '1', code: 'DEFECTIVE', name: 'Defective Item' }];
    (prisma.returnReason.findMany as jest.Mock).mockResolvedValue(mockList);

    const res = await service.findAll(mockOrgId, { isActive: true });
    expect(res).toEqual(mockList);
    expect(prisma.returnReason.findMany).toHaveBeenCalledWith({
      where: { organizationId: mockOrgId, isActive: true },
      orderBy: { code: 'asc' },
    });
  });

  it('should throw NotFoundException if reason not found', async () => {
    (prisma.returnReason.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne(mockOrgId, 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should create new return reason and emit event', async () => {
    (prisma.returnReason.findUnique as jest.Mock).mockResolvedValue(null);
    const createdReason = {
      id: 'reason-1',
      organizationId: mockOrgId,
      code: 'DAMAGED_TRANSIT',
      name: 'Damaged in transit',
      requiresInspection: true,
      defaultDisposition: 'SCRAP',
      isActive: true,
    };
    (prisma.returnReason.create as jest.Mock).mockResolvedValue(createdReason);

    const res = await service.create(
      mockOrgId,
      {
        code: 'DAMAGED_TRANSIT',
        name: 'Damaged in transit',
        requiresInspection: true,
        defaultDisposition: 'SCRAP',
      },
      mockUserId,
    );

    expect(res).toEqual(createdReason);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_REASON_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should throw ConflictException on duplicate code within organization', async () => {
    (prisma.returnReason.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing',
    });

    await expect(
      service.create(mockOrgId, { code: 'DEFECTIVE', name: 'Defective' }),
    ).rejects.toThrow(ConflictException);
  });
});
