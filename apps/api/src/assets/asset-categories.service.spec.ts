import { Test, TestingModule } from '@nestjs/testing';
import { AssetCategoriesService } from './asset-categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('AssetCategoriesService', () => {
  let service: AssetCategoriesService;
  let prisma: any;
  let eventBus: any;

  const orgId = 'org-asset-test';
  const userId = 'user-test';

  beforeEach(async () => {
    prisma = {
      assetCategory: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      fixedAsset: {
        count: jest.fn(),
      },
      account: {
        findMany: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetCategoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<AssetCategoriesService>(AssetCategoriesService);
  });

  describe('create', () => {
    it('should create an asset category successfully', async () => {
      prisma.assetCategory.findFirst.mockResolvedValue(null);
      prisma.assetCategory.create.mockResolvedValue({
        id: 'cat-1',
        organizationId: orgId,
        code: 'COMP',
        name: 'Computers & IT',
        defaultUsefulLifeMonths: 36,
        defaultResidualValuePercent: new Prisma.Decimal(10),
      });

      const result = await service.create(
        orgId,
        {
          code: 'COMP',
          name: 'Computers & IT',
          defaultUsefulLifeMonths: 36,
          defaultResidualValuePercent: 10,
        },
        userId,
      );

      expect(result.id).toBe('cat-1');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ASSET_CATEGORY_CREATED' }),
      );
    });

    it('should reject duplicate category code in same org', async () => {
      prisma.assetCategory.findFirst.mockResolvedValue({ id: 'cat-dup' });

      await expect(
        service.create(orgId, { code: 'COMP', name: 'Duplicate' }, userId),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject non-existent GL account mapping', async () => {
      prisma.assetCategory.findFirst.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([]); // Account not found

      await expect(
        service.create(
          orgId,
          {
            code: 'COMP',
            name: 'Computers',
            assetAccountId: '11111111-1111-1111-1111-111111111111',
          },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update and delete', () => {
    it('should update category and emit audit event', async () => {
      prisma.assetCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        organizationId: orgId,
        code: 'COMP',
        name: 'Computers',
      });
      prisma.assetCategory.update.mockResolvedValue({
        id: 'cat-1',
        name: 'Computers & Laptops',
      });

      const result = await service.update(
        orgId,
        'cat-1',
        { name: 'Computers & Laptops' },
        userId,
      );

      expect(result.name).toBe('Computers & Laptops');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ASSET_CATEGORY_UPDATED' }),
      );
    });

    it('should prevent deleting category with existing active assets', async () => {
      prisma.assetCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        code: 'COMP',
      });
      prisma.fixedAsset.count.mockResolvedValue(3); // 3 assets exist

      await expect(service.delete(orgId, 'cat-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should soft delete category when no assets are linked', async () => {
      prisma.assetCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        code: 'COMP',
      });
      prisma.fixedAsset.count.mockResolvedValue(0);
      prisma.assetCategory.update.mockResolvedValue({
        id: 'cat-1',
        deletedAt: new Date(),
      });

      const res = await service.delete(orgId, 'cat-1');
      expect(res.deletedAt).toBeDefined();
    });
  });
});
