import { Test, TestingModule } from '@nestjs/testing';
import { BomExplosionService } from './bom-explosion.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { BomStatus, Prisma } from '@prisma/client';

describe('BomExplosionService', () => {
  let service: BomExplosionService;
  let prisma: any;

  const mockOrgId = 'org-mrp-1';
  const finishedItemId = 'item-finished-100';
  const subAssemblyId = 'item-subassembly-200';
  const rawMaterialA = 'item-raw-a';
  const rawMaterialB = 'item-raw-b';

  beforeEach(async () => {
    prisma = {
      billOfMaterial: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BomExplosionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BomExplosionService>(BomExplosionService);
  });

  it('should explode single-level BOM with scrap percentages accurately', async () => {
    // Top-level BOM for Finished Product
    prisma.billOfMaterial.findFirst.mockImplementation(({ where }: any) => {
      if (where.itemId === finishedItemId) {
        return Promise.resolve({
          id: 'bom-finished',
          bomNumber: 'BOM-001',
          itemId: finishedItemId,
          quantity: new Prisma.Decimal(1),
          status: BomStatus.ACTIVE,
          lines: [
            {
              itemId: rawMaterialA,
              quantity: new Prisma.Decimal(2),
              scrapPercentage: new Prisma.Decimal(0),
              lineNumber: 1,
            },
            {
              itemId: rawMaterialB,
              quantity: new Prisma.Decimal(1),
              scrapPercentage: new Prisma.Decimal(10), // 10% scrap
              lineNumber: 2,
            },
          ],
        });
      }
      return Promise.resolve(null); // raw materials have no BOM
    });

    const result = await service.explode(
      mockOrgId,
      finishedItemId,
      new Prisma.Decimal(100), // Demand 100 units
    );

    expect(result).toHaveLength(2);
    // Raw A: 100 * 2 = 200
    expect(Number(result[0].requiredQuantity)).toBe(200);
    expect(result[0].isLeaf).toBe(true);

    // Raw B: 100 * 1 * 1.10 = 110
    expect(Number(result[1].requiredQuantity)).toBe(110);
    expect(result[1].isLeaf).toBe(true);
  });

  it('should explode multi-level BOM recursively', async () => {
    prisma.billOfMaterial.findFirst.mockImplementation(({ where }: any) => {
      if (where.itemId === finishedItemId) {
        return Promise.resolve({
          id: 'bom-1',
          bomNumber: 'BOM-001',
          itemId: finishedItemId,
          quantity: new Prisma.Decimal(1),
          status: BomStatus.ACTIVE,
          lines: [
            {
              itemId: subAssemblyId,
              quantity: new Prisma.Decimal(2),
              scrapPercentage: new Prisma.Decimal(0),
              lineNumber: 1,
            },
          ],
        });
      }
      if (where.itemId === subAssemblyId) {
        return Promise.resolve({
          id: 'bom-sub',
          bomNumber: 'BOM-SUB-001',
          itemId: subAssemblyId,
          quantity: new Prisma.Decimal(1),
          status: BomStatus.ACTIVE,
          lines: [
            {
              itemId: rawMaterialA,
              quantity: new Prisma.Decimal(5),
              scrapPercentage: new Prisma.Decimal(0),
              lineNumber: 1,
            },
          ],
        });
      }
      return Promise.resolve(null);
    });

    const result = await service.explode(
      mockOrgId,
      finishedItemId,
      new Prisma.Decimal(10), // Demand 10 finished goods
    );

    // Level 1: 10 * 2 = 20 Subassemblies
    // Level 2: 20 * 5 = 100 Raw Material A
    expect(result).toHaveLength(2);
    expect(result[0].level).toBe(1);
    expect(result[0].itemId).toBe(subAssemblyId);
    expect(Number(result[0].requiredQuantity)).toBe(20);

    expect(result[1].level).toBe(2);
    expect(result[1].itemId).toBe(rawMaterialA);
    expect(Number(result[1].requiredQuantity)).toBe(100);
    expect(result[1].isLeaf).toBe(true);
  });

  it('should detect and safely reject circular BOM explosion dependencies', async () => {
    prisma.billOfMaterial.findFirst.mockImplementation(({ where }: any) => {
      if (where.itemId === finishedItemId) {
        return Promise.resolve({
          id: 'bom-1',
          bomNumber: 'BOM-001',
          itemId: finishedItemId,
          quantity: new Prisma.Decimal(1),
          status: BomStatus.ACTIVE,
          lines: [
            {
              itemId: subAssemblyId,
              quantity: new Prisma.Decimal(1),
              scrapPercentage: new Prisma.Decimal(0),
            },
          ],
        });
      }
      if (where.itemId === subAssemblyId) {
        return Promise.resolve({
          id: 'bom-sub',
          bomNumber: 'BOM-SUB',
          itemId: subAssemblyId,
          quantity: new Prisma.Decimal(1),
          status: BomStatus.ACTIVE,
          lines: [
            {
              itemId: finishedItemId,
              quantity: new Prisma.Decimal(1),
              scrapPercentage: new Prisma.Decimal(0),
            },
          ], // circular back to finished
        });
      }
      return Promise.resolve(null);
    });

    await expect(
      service.explode(mockOrgId, finishedItemId, new Prisma.Decimal(10)),
    ).rejects.toThrow(BadRequestException);
  });
});
