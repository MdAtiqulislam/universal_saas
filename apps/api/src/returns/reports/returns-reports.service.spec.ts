import { Test, TestingModule } from '@nestjs/testing';
import { ReturnsReportsService } from './returns-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ReturnDispositionType, ReturnType } from '@prisma/client';

describe('ReturnsReportsService', () => {
  let service: ReturnsReportsService;
  let prisma: PrismaService;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnsReportsService,
        {
          provide: PrismaService,
          useValue: {
            returnRequest: {
              count: jest.fn().mockResolvedValue(10),
              findMany: jest.fn().mockResolvedValue([]),
            },
            returnRequestLine: {
              findMany: jest.fn().mockResolvedValue([
                {
                  requestedQuantity: new Prisma.Decimal('10.0000'),
                  authorizedQuantity: new Prisma.Decimal('10.0000'),
                  receivedQuantity: new Prisma.Decimal('10.0000'),
                  inspectedQuantity: new Prisma.Decimal('10.0000'),
                  acceptedQuantity: new Prisma.Decimal('8.0000'),
                  rejectedQuantity: new Prisma.Decimal('2.0000'),
                  lineAmount: new Prisma.Decimal('1000.0000'),
                },
              ]),
            },
            returnReason: { findMany: jest.fn().mockResolvedValue([]) },
            returnDispositionRecord: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            returnResolution: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
      ],
    }).compile();

    service = module.get<ReturnsReportsService>(ReturnsReportsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should generate summary report with progressive counts and total financial value', async () => {
    const summary = await service.getSummaryReport(mockOrgId);

    expect(summary.totalRmas).toBe(10);
    expect(summary.quantities.requested).toBe(10);
    expect(summary.quantities.accepted).toBe(8);
    expect(summary.quantities.rejected).toBe(2);
    expect(summary.totalFinancialValue).toBe(1000);
  });

  it('should generate customer returns report with relations', async () => {
    (prisma.returnRequest.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rma-1',
        returnNumber: 'RMA-000001',
        returnType: ReturnType.CUSTOMER_RETURN,
        status: 'RECEIVED',
        customer: { id: 'cust-1', name: 'Acme Corp', code: 'CUST-001' },
        salesOrder: { orderNumber: 'SO-001' },
        shipment: { shipmentNumber: 'SHP-001' },
        reason: { name: 'Damaged' },
        requestedAt: new Date(),
        lines: [
          {
            requestedQuantity: new Prisma.Decimal('5.0000'),
            receivedQuantity: new Prisma.Decimal('5.0000'),
            lineAmount: new Prisma.Decimal('500.0000'),
          },
        ],
        resolutions: [],
      },
    ]);

    const res = await service.getCustomerReturnsReport(mockOrgId);
    expect(res).toHaveLength(1);
    expect(res[0].returnNumber).toBe('RMA-000001');
    expect(res[0].totalRequestedQty).toBe(5);
  });

  it('should generate disposition breakdown analysis', async () => {
    (prisma.returnDispositionRecord.findMany as jest.Mock).mockResolvedValue([
      {
        dispositionType: ReturnDispositionType.RESTOCK,
        quantity: new Prisma.Decimal('10.0000'),
      },
      {
        dispositionType: ReturnDispositionType.SCRAP,
        quantity: new Prisma.Decimal('2.0000'),
      },
    ]);

    const res = await service.getDispositionAnalysisReport(mockOrgId);
    expect(res.length).toBeGreaterThan(0);
    const restock = res.find(
      (d) => d.dispositionType === ReturnDispositionType.RESTOCK,
    );
    expect(restock?.count).toBe(1);
    expect(restock?.totalQuantity).toBe(10);
  });
});
