import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations/locations.service';
import { TaxesService } from './taxes/taxes.service';
import { NumberingService } from './numbering/numbering.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { Prisma } from '@prisma/client';

describe('Tenant Master Data Isolation', () => {
  let locationsService: LocationsService;
  let taxesService: TaxesService;
  let numberingService: NumberingService;
  let prismaMock: any;

  const orgAlpha = 'org-alpha-1111';
  const orgBeta = 'org-beta-2222';

  beforeEach(async () => {
    prismaMock = {
      location: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      taxRate: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      numberingSequence: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        TaxesService,
        NumberingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    locationsService = module.get<LocationsService>(LocationsService);
    taxesService = module.get<TaxesService>(TaxesService);
    numberingService = module.get<NumberingService>(NumberingService);
  });

  describe('Location Isolation', () => {
    it('1. Org Alpha cannot read Org Beta locations', async () => {
      prismaMock.location.findFirst.mockResolvedValue(null);

      await expect(
        locationsService.findOne(orgAlpha, 'loc-in-beta'),
      ).rejects.toThrow(NotFoundException);
    });

    it('2. Org Alpha cannot assign Org Beta location as a parent', async () => {
      prismaMock.location.findFirst
        .mockResolvedValueOnce(null) // code check passed
        .mockResolvedValueOnce(null); // parent not found in Org Alpha

      await expect(
        locationsService.create(orgAlpha, {
          name: 'Sub Branch',
          code: 'SUB-01',
          parentId: 'loc-in-beta',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("3. Same location code 'WH-01' can coexist independently in Org Alpha and Org Beta", async () => {
      // In Alpha
      prismaMock.location.findFirst.mockResolvedValue(null);
      prismaMock.location.create.mockResolvedValue({
        id: 'loc-a',
        organizationId: orgAlpha,
        code: 'WH-01',
        name: 'Alpha Warehouse',
      });

      const alphaLoc = await locationsService.create(orgAlpha, {
        name: 'Alpha Warehouse',
        code: 'WH-01',
      });

      // In Beta
      prismaMock.location.findFirst.mockResolvedValue(null);
      prismaMock.location.create.mockResolvedValue({
        id: 'loc-b',
        organizationId: orgBeta,
        code: 'WH-01',
        name: 'Beta Warehouse',
      });

      const betaLoc = await locationsService.create(orgBeta, {
        name: 'Beta Warehouse',
        code: 'WH-01',
      });

      expect(alphaLoc.code).toBe('WH-01');
      expect(betaLoc.code).toBe('WH-01');
      expect(alphaLoc.organizationId).not.toBe(betaLoc.organizationId);
    });
  });

  describe('Tax Rate Isolation', () => {
    it('4. Org Alpha cannot access Org Beta tax rates', async () => {
      prismaMock.taxRate.findFirst.mockResolvedValue(null);

      await expect(
        taxesService.findOne(orgAlpha, 'tax-in-beta'),
      ).rejects.toThrow(NotFoundException);
    });

    it("5. Same tax code 'VAT-15' can coexist in Org Alpha and Org Beta", async () => {
      prismaMock.taxRate.findFirst.mockResolvedValue(null);
      prismaMock.taxRate.create
        .mockResolvedValueOnce({
          id: 'tax-a',
          organizationId: orgAlpha,
          code: 'VAT-15',
          rate: new Prisma.Decimal(15),
        })
        .mockResolvedValueOnce({
          id: 'tax-b',
          organizationId: orgBeta,
          code: 'VAT-15',
          rate: new Prisma.Decimal(15),
        });

      const taxA = await taxesService.create(orgAlpha, {
        name: 'VAT 15',
        code: 'VAT-15',
        rate: 15,
      });
      const taxB = await taxesService.create(orgBeta, {
        name: 'VAT 15',
        code: 'VAT-15',
        rate: 15,
      });

      expect(taxA.code).toBe('VAT-15');
      expect(taxB.code).toBe('VAT-15');
    });
  });

  describe('Numbering Sequence Isolation', () => {
    it('6. Org Alpha cannot access Org Beta numbering sequence', async () => {
      prismaMock.numberingSequence.findFirst.mockResolvedValue(null);

      await expect(
        numberingService.findOne(orgAlpha, 'seq-in-beta'),
      ).rejects.toThrow(NotFoundException);
    });

    it("7. Same sequence key 'INVOICE' can coexist in Org Alpha and Org Beta", async () => {
      prismaMock.numberingSequence.findFirst.mockResolvedValue(null);
      prismaMock.numberingSequence.create
        .mockResolvedValueOnce({
          id: 'seq-a',
          organizationId: orgAlpha,
          key: 'INVOICE',
          nextNumber: BigInt(1),
        })
        .mockResolvedValueOnce({
          id: 'seq-b',
          organizationId: orgBeta,
          key: 'INVOICE',
          nextNumber: BigInt(1),
        });

      const seqA = await numberingService.create(orgAlpha, { key: 'INVOICE' });
      const seqB = await numberingService.create(orgBeta, { key: 'INVOICE' });

      expect(seqA.key).toBe('INVOICE');
      expect(seqB.key).toBe('INVOICE');
    });
  });
});
