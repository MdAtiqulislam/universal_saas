import { Test, TestingModule } from '@nestjs/testing';
import { TaxCodesService } from './tax-codes.service';
import { TaxJurisdictionsService } from './tax-jurisdictions.service';
import { TaxTransactionsService } from './tax-transactions.service';
import { TaxPeriodsService } from './tax-periods.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Tax Isolation', () => {
  let codesService: TaxCodesService;
  let jurisdictionsService: TaxJurisdictionsService;
  let transactionsService: TaxTransactionsService;
  let periodsService: TaxPeriodsService;
  let prismaMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      taxCode: {
        findFirst: jest.fn().mockImplementation((args) => {
          if (
            args.where.organizationId === orgA &&
            args.where.id === 'code-A'
          ) {
            return Promise.resolve({ id: 'code-A', organizationId: orgA });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation((args) => {
          if (args.where.organizationId === orgA) {
            return Promise.resolve([{ id: 'code-A', organizationId: orgA }]);
          }
          return Promise.resolve([]);
        }),
      },
      taxJurisdiction: {
        findFirst: jest.fn().mockImplementation((args) => {
          if (args.where.organizationId === orgA && args.where.id === 'jur-A') {
            return Promise.resolve({ id: 'jur-A', organizationId: orgA });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation((args) => {
          if (args.where.organizationId === orgA) {
            return Promise.resolve([{ id: 'jur-A', organizationId: orgA }]);
          }
          return Promise.resolve([]);
        }),
      },
      taxTransaction: {
        findFirst: jest.fn().mockImplementation((args) => {
          if (args.where.organizationId === orgA && args.where.id === 'tx-A') {
            return Promise.resolve({ id: 'tx-A', organizationId: orgA });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation((args) => {
          if (args.where.organizationId === orgA) {
            return Promise.resolve([{ id: 'tx-A', organizationId: orgA }]);
          }
          return Promise.resolve([]);
        }),
        count: jest.fn().mockResolvedValue(0),
      },
      taxPeriod: {
        findFirst: jest.fn().mockImplementation((args) => {
          if (
            args.where.organizationId === orgA &&
            args.where.id === 'period-A'
          ) {
            return Promise.resolve({ id: 'period-A', organizationId: orgA });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation((args) => {
          if (args.where.organizationId === orgA) {
            return Promise.resolve([{ id: 'period-A', organizationId: orgA }]);
          }
          return Promise.resolve([]);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxCodesService,
        TaxJurisdictionsService,
        TaxTransactionsService,
        TaxPeriodsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        {
          provide: ApAccountMappingService,
          useValue: { resolveAccount: jest.fn() },
        },
      ],
    }).compile();

    codesService = module.get<TaxCodesService>(TaxCodesService);
    jurisdictionsService = module.get<TaxJurisdictionsService>(
      TaxJurisdictionsService,
    );
    transactionsService = module.get<TaxTransactionsService>(
      TaxTransactionsService,
    );
    periodsService = module.get<TaxPeriodsService>(TaxPeriodsService);
  });

  it('1. Org B cannot view Org A tax codes', async () => {
    await expect(codesService.findOne(orgB, 'code-A')).rejects.toThrow(
      NotFoundException,
    );
    const codesB = await codesService.findAll(orgB);
    expect(codesB.length).toBe(0);
  });

  it('2. Org B cannot view Org A tax jurisdictions', async () => {
    await expect(jurisdictionsService.findOne(orgB, 'jur-A')).rejects.toThrow(
      NotFoundException,
    );
    const jursB = await jurisdictionsService.findAll(orgB);
    expect(jursB.length).toBe(0);
  });

  it('3. Org B cannot view Org A tax transactions', async () => {
    await expect(transactionsService.findOne(orgB, 'tx-A')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. Org B cannot view Org A tax periods', async () => {
    await expect(periodsService.findOne(orgB, 'period-A')).rejects.toThrow(
      NotFoundException,
    );
  });
});
