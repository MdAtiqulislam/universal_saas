import { Test, TestingModule } from '@nestjs/testing';
import { SupplierInvoicesService } from './invoices/supplier-invoices.service';
import { AccountsPayableMatchingService } from './matching/accounts-payable-matching.service';
import { ApAccountMappingService } from './account-mapping/ap-account-mapping.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant AP Isolation', () => {
  let invoiceService: SupplierInvoicesService;
  let matchingService: AccountsPayableMatchingService;
  let mappingService: ApAccountMappingService;
  let prismaMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const mockInvoiceId = '33333333-3333-3333-3333-333333333333';
  const mockSupplierId = '44444444-4444-4444-4444-444444444444';
  const mockUserId = '55555555-5555-5555-5555-555555555555';

  beforeEach(async () => {
    prismaMock = {
      supplier: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.organizationId === orgA && where.id === mockSupplierId) {
            return Promise.resolve({
              id: mockSupplierId,
              organizationId: orgA,
              name: 'Org A Supplier',
              isActive: true,
            });
          }
          return Promise.resolve(null);
        }),
      },
      supplierInvoice: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.organizationId === orgA && where.id === mockInvoiceId) {
            return Promise.resolve({
              id: mockInvoiceId,
              organizationId: orgA,
              invoiceNumber: 'SI-000001',
              status: 'DRAFT',
              supplier: {
                id: mockSupplierId,
                name: 'Org A Supplier',
                paymentTermsDays: 30,
              },
              currency: { id: 'c-1', code: 'USD', symbol: '$' },
              lines: [],
            });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where.organizationId === orgA) {
            return Promise.resolve([
              { id: mockInvoiceId, organizationId: orgA },
            ]);
          }
          return Promise.resolve([]);
        }),
        count: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(where.organizationId === orgA ? 1 : 0);
        }),
      },
      accountingAccountMapping: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where.organizationId === orgA) {
            return Promise.resolve([
              { id: 'm-1', organizationId: orgA, key: 'ACCOUNTS_PAYABLE' },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierInvoicesService,
        AccountsPayableMatchingService,
        ApAccountMappingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
      ],
    }).compile();

    invoiceService = module.get<SupplierInvoicesService>(
      SupplierInvoicesService,
    );
    matchingService = module.get<AccountsPayableMatchingService>(
      AccountsPayableMatchingService,
    );
    mappingService = module.get<ApAccountMappingService>(
      ApAccountMappingService,
    );
  });

  it('1. Org B should not find Org A supplier invoices', async () => {
    await expect(invoiceService.findOne(orgB, mockInvoiceId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('2. Org B listing should return 0 invoices when Org A has invoices', async () => {
    const resA = await invoiceService.findAll(orgA, {});
    const resB = await invoiceService.findAll(orgB, {});

    expect(resA.total).toBe(1);
    expect(resB.total).toBe(0);
    expect(resB.invoices).toHaveLength(0);
  });

  it('3. Org B cannot submit Org A supplier invoice', async () => {
    await expect(
      invoiceService.submit(orgB, mockInvoiceId, mockUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. Org B cannot approve Org A supplier invoice', async () => {
    await expect(
      invoiceService.approve(orgB, mockInvoiceId, mockUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Org B cannot post Org A supplier invoice', async () => {
    await expect(
      invoiceService.post(orgB, mockInvoiceId, mockUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it('6. Org B cannot cancel Org A supplier invoice', async () => {
    await expect(
      invoiceService.cancel(orgB, mockInvoiceId, mockUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Org B cannot void Org A supplier invoice', async () => {
    await expect(
      invoiceService.void(orgB, mockInvoiceId, mockUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it('8. Org B cannot perform 3-way matching on Org A invoice', async () => {
    await expect(
      matchingService.matchInvoice(orgB, mockInvoiceId, mockUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it('9. Org B cannot see Org A account mappings', async () => {
    const mappings = await mappingService.findAll(orgB);
    expect(mappings).toHaveLength(0);
  });

  it('10. Org B cannot create invoice referencing Org A supplier', async () => {
    await expect(
      invoiceService.create(
        orgB,
        {
          supplierId: mockSupplierId,
          invoiceDate: '2026-08-01',
          lines: [{ itemId: 'item-1', quantity: 1, unitPrice: 10 }],
        },
        mockUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
