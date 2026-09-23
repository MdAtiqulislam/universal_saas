import { Test, TestingModule } from '@nestjs/testing';
import { PlanningConfigService } from './planning-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('PlanningConfigService', () => {
  let service: PlanningConfigService;
  let prisma: any;
  let eventBus: any;

  const mockOrgId = 'org-planning-1';
  const mockUserId = 'user-planning-1';

  beforeEach(async () => {
    prisma = {
      planningConfiguration: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      itemPlanningProfile: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      item: {
        findFirst: jest.fn(),
      },
      itemVariant: {
        findFirst: jest.fn(),
      },
      supplier: {
        findFirst: jest.fn(),
      },
      billOfMaterial: {
        findFirst: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<PlanningConfigService>(PlanningConfigService);
  });

  describe('getConfig', () => {
    it('should return existing planning configuration', async () => {
      prisma.planningConfiguration.findUnique.mockResolvedValue({
        id: 'cfg-1',
        organizationId: mockOrgId,
        defaultPlanningHorizonDays: 45,
      });

      const config = await service.getConfig(mockOrgId);
      expect(config.defaultPlanningHorizonDays).toBe(45);
    });

    it('should create default configuration if none exists', async () => {
      prisma.planningConfiguration.findUnique.mockResolvedValue(null);
      prisma.planningConfiguration.create.mockResolvedValue({
        id: 'cfg-default',
        organizationId: mockOrgId,
        defaultPlanningHorizonDays: 30,
      });

      const config = await service.getConfig(mockOrgId);
      expect(config.defaultPlanningHorizonDays).toBe(30);
      expect(prisma.planningConfiguration.create).toHaveBeenCalled();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration and publish audit event', async () => {
      prisma.planningConfiguration.findUnique.mockResolvedValue({
        id: 'cfg-1',
        organizationId: mockOrgId,
      });
      prisma.planningConfiguration.update.mockResolvedValue({
        id: 'cfg-1',
        organizationId: mockOrgId,
        defaultPlanningHorizonDays: 60,
        defaultLeadTimeDays: 14,
      });

      const updated = await service.updateConfig(
        mockOrgId,
        { defaultPlanningHorizonDays: 60, defaultLeadTimeDays: 14 },
        mockUserId,
      );

      expect(updated.defaultPlanningHorizonDays).toBe(60);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'MRP_CONFIGURATION_UPDATED' }),
      );
    });
  });

  describe('upsertItemProfile', () => {
    it('should create item profile when none exists', async () => {
      prisma.item.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: mockOrgId,
      });
      prisma.itemPlanningProfile.findFirst.mockResolvedValue(null);
      prisma.itemPlanningProfile.create.mockResolvedValue({
        id: 'ipp-1',
        organizationId: mockOrgId,
        itemId: 'item-1',
        safetyStock: new Prisma.Decimal(50),
        minOrderQuantity: new Prisma.Decimal(10),
      });

      const profile = await service.upsertItemProfile(
        mockOrgId,
        {
          itemId: 'item-1',
          safetyStock: 50,
          minOrderQuantity: 10,
        },
        mockUserId,
      );

      expect(profile).toBeDefined();
      expect(prisma.itemPlanningProfile.create).toHaveBeenCalled();
    });

    it('should reject profile creation if item does not exist', async () => {
      prisma.item.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertItemProfile(
          mockOrgId,
          { itemId: 'non-existent' },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
