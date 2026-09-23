import { Test, TestingModule } from '@nestjs/testing';
import { ReturnPoliciesService } from './return-policies.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { Prisma } from '@prisma/client';

describe('ReturnPoliciesService', () => {
  let service: ReturnPoliciesService;
  let prisma: PrismaService;
  let eventBus: EventBusService;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnPoliciesService,
        {
          provide: PrismaService,
          useValue: {
            returnPolicy: {
              findUnique: jest.fn(),
              create: jest.fn(),
              upsert: jest.fn(),
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

    service = module.get<ReturnPoliciesService>(ReturnPoliciesService);
    prisma = module.get<PrismaService>(PrismaService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should auto-create default policy if none exists', async () => {
    (prisma.returnPolicy.findUnique as jest.Mock).mockResolvedValue(null);
    const mockCreated = {
      id: 'pol-1',
      organizationId: mockOrgId,
      returnWindowDays: 30,
      requireInspection: true,
      autoQuarantine: true,
    };
    (prisma.returnPolicy.create as jest.Mock).mockResolvedValue(mockCreated);

    const res = await service.getPolicy(mockOrgId);
    expect(res).toEqual(mockCreated);
    expect(prisma.returnPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          returnWindowDays: 30,
        }),
      }),
    );
  });

  it('should update return policy and publish domain event', async () => {
    const mockUpdated = {
      id: 'pol-1',
      organizationId: mockOrgId,
      returnWindowDays: 60,
      requireInspection: false,
      autoQuarantine: true,
      maxReplacementQty: new Prisma.Decimal(200),
    };
    (prisma.returnPolicy.upsert as jest.Mock).mockResolvedValue(mockUpdated);

    const res = await service.updatePolicy(
      mockOrgId,
      {
        returnWindowDays: 60,
        requireInspection: false,
        maxReplacementQty: 200,
      },
      'user-1',
    );

    expect(res).toEqual(mockUpdated);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_POLICY_UPDATED',
        organizationId: mockOrgId,
      }),
    );
  });
});
