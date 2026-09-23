import { Test, TestingModule } from '@nestjs/testing';
import { WarrantyEligibilityService } from '../warranty/warranty-eligibility.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { WarrantyStatus, WarrantyCoverageType } from '@prisma/client';

describe('WarrantyEligibilityService', () => {
  let service: WarrantyEligibilityService;
  let prisma: any;
  let eventBus: any;

  const mockOrgId = 'org-1111-2222-3333-4444';
  const mockAssetId = 'asset-1111-2222-3333-4444';

  beforeEach(async () => {
    prisma = {
      customerAsset: {
        findFirst: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarrantyEligibilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<WarrantyEligibilityService>(
      WarrantyEligibilityService,
    );
  });

  it('should return eligible = true when asset is within active warranty window', async () => {
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2027-01-01');
    const serviceDate = new Date('2026-06-01');

    prisma.customerAsset.findFirst.mockResolvedValue({
      id: mockAssetId,
      organizationId: mockOrgId,
      assetNumber: 'CSA-000001',
      warrantyStartDate: startDate,
      warrantyEndDate: endDate,
      warrantyStatus: WarrantyStatus.ACTIVE,
      warranties: [],
    });

    const result = await service.checkEligibility(
      mockOrgId,
      {
        customerAssetId: mockAssetId,
        serviceDate: serviceDate.toISOString(),
      },
      'user-1',
    );

    expect(result.eligible).toBe(true);
    expect(result.warrantyStatus).toBe(WarrantyStatus.ACTIVE);
    expect(result.partsCovered).toBe(true);
    expect(result.laborCovered).toBe(true);
    expect(result.remainingWarrantyDays).toBeGreaterThan(0);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'WARRANTY_ELIGIBILITY_CHECKED',
      }),
    );
  });

  it('should return eligible = false when asset warranty is expired', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2025-01-01');
    const serviceDate = new Date('2026-06-01');

    prisma.customerAsset.findFirst.mockResolvedValue({
      id: mockAssetId,
      organizationId: mockOrgId,
      assetNumber: 'CSA-000001',
      warrantyStartDate: startDate,
      warrantyEndDate: endDate,
      warrantyStatus: WarrantyStatus.ACTIVE,
      warranties: [],
    });

    const result = await service.checkEligibility(
      mockOrgId,
      {
        customerAssetId: mockAssetId,
        serviceDate: serviceDate.toISOString(),
      },
      'user-1',
    );

    expect(result.eligible).toBe(false);
    expect(result.warrantyStatus).toBe(WarrantyStatus.EXPIRED);
    expect(result.remainingWarrantyDays).toBe(0);
  });

  it('should return eligible = false when asset warranty is explicitly VOIDED', async () => {
    prisma.customerAsset.findFirst.mockResolvedValue({
      id: mockAssetId,
      organizationId: mockOrgId,
      assetNumber: 'CSA-000001',
      warrantyStartDate: new Date('2026-01-01'),
      warrantyEndDate: new Date('2027-01-01'),
      warrantyStatus: WarrantyStatus.VOIDED,
      warranties: [],
    });

    const result = await service.checkEligibility(
      mockOrgId,
      {
        customerAssetId: mockAssetId,
      },
      'user-1',
    );

    expect(result.eligible).toBe(false);
    expect(result.warrantyStatus).toBe(WarrantyStatus.VOIDED);
    expect(result.reason).toContain('voided');
  });

  it('should respect policy-specific coverage flags (PARTS_ONLY)', async () => {
    const serviceDate = new Date('2026-06-01');

    prisma.customerAsset.findFirst.mockResolvedValue({
      id: mockAssetId,
      organizationId: mockOrgId,
      assetNumber: 'CSA-000001',
      warrantyStartDate: new Date('2026-01-01'),
      warrantyEndDate: new Date('2027-01-01'),
      warrantyStatus: WarrantyStatus.ACTIVE,
      warranties: [
        {
          status: WarrantyStatus.ACTIVE,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2027-01-01'),
          warrantyPolicy: {
            code: 'PARTS-ONLY',
            name: 'Parts Only Coverage',
            coverageType: WarrantyCoverageType.PARTS_ONLY,
            partsCovered: true,
            laborCovered: false,
            replacementCovered: false,
            isActive: true,
          },
        },
      ],
    });

    const result = await service.checkEligibility(
      mockOrgId,
      {
        customerAssetId: mockAssetId,
        serviceDate: serviceDate.toISOString(),
      },
      'user-1',
    );

    expect(result.eligible).toBe(true);
    expect(result.coverageType).toBe(WarrantyCoverageType.PARTS_ONLY);
    expect(result.partsCovered).toBe(true);
    expect(result.laborCovered).toBe(false);
  });
});
