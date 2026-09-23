import { AnalyticsQueryEngineService } from '../services/analytics-query-engine.service';
import { TimeAnalyticsService } from '../services/time-analytics.service';
import { AnalyticsDefinitionRegistry } from '../registry/analytics-definition.registry';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  validateFilterAst,
  AstValidationError,
} from '../dto/analytics-query.dto';

describe('AnalyticsQueryEngineService (INV-502, INV-503, INV-504, INV-505, INV-507)', () => {
  let engine: AnalyticsQueryEngineService;
  let timeService: TimeAnalyticsService;
  let mockPrisma: any;
  let mockUsageRepo: any;

  beforeEach(() => {
    timeService = new TimeAnalyticsService();
    mockPrisma = {
      salesOrder: {
        findMany: jest.fn().mockResolvedValue([
          {
            customerId: 'c1',
            currency: 'USD',
            status: 'COMPLETED',
            totalRevenue: 100050,
            createdAt: new Date('2026-03-01T10:00:00Z'),
          },
          {
            customerId: 'c1',
            currency: 'USD',
            status: 'COMPLETED',
            totalRevenue: 200050,
            createdAt: new Date('2026-03-02T11:00:00Z'),
          },
          {
            customerId: 'c2',
            currency: 'EUR',
            status: 'PENDING',
            totalRevenue: 50000,
            createdAt: new Date('2026-03-03T12:00:00Z'),
          },
        ]),
      },
    };
    mockUsageRepo = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    engine = new AnalyticsQueryEngineService(
      mockPrisma,
      timeService,
      mockUsageRepo,
    );
  });

  it('INV-501: throws NotFoundException when definition key does not exist', () => {
    expect(() =>
      engine.validateQuery({ definitionKey: 'invalid.dataset' }),
    ).toThrow(NotFoundException);
  });

  it('INV-502: throws BadRequestException when specifying uncatalogued dimension', () => {
    expect(() =>
      engine.validateQuery({
        definitionKey: 'sales.revenue',
        dimensions: ['maliciousDimension'],
      }),
    ).toThrow(BadRequestException);
  });

  it('INV-502: throws BadRequestException when specifying unsupported aggregation', () => {
    expect(() =>
      engine.validateQuery({
        definitionKey: 'sales.revenue',
        measures: [{ name: 'totalRevenue', aggregation: 'COUNT' as any }],
      }),
    ).toThrow(BadRequestException);
  });

  it('INV-504: rejects AST with depth greater than 5', () => {
    const deepAst: any = {
      and: [
        {
          and: [
            {
              and: [
                {
                  and: [
                    {
                      and: [
                        { field: 'currency', operator: 'eq', value: 'USD' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(() => validateFilterAst(deepAst, ['currency', 'status'])).toThrow(
      AstValidationError,
    );
  });

  it('INV-504: rejects AST with more than 20 nodes', () => {
    const manyNodes: any = {
      and: Array.from({ length: 21 }, (_, i) => ({
        field: 'status',
        operator: 'eq',
        value: `STATUS_${i}`,
      })),
    };

    expect(() => validateFilterAst(manyNodes, ['status'])).toThrow(
      AstValidationError,
    );
  });

  it('INV-504: rejects invalid/unsupported filter operators', () => {
    const invalidOpAst: any = {
      field: 'status',
      operator: 'raw_sql_inject' as any,
      value: 'ACTIVE',
    };

    expect(() => validateFilterAst(invalidOpAst, ['status'])).toThrow(
      AstValidationError,
    );
  });

  it('INV-505: rejects limit < 1 or limit > 1000', () => {
    expect(() =>
      engine.validateQuery({
        definitionKey: 'sales.revenue',
        limit: 0,
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      engine.validateQuery({
        definitionKey: 'sales.revenue',
        limit: 1001,
      }),
    ).toThrow(BadRequestException);
  });

  it('INV-507: performs financial aggregation in minor-unit integer cents without floating-point errors', () => {
    const def = AnalyticsDefinitionRegistry.get('sales.revenue')!;
    const records = [
      { customerId: 'c1', totalRevenue: 100033 },
      { customerId: 'c1', totalRevenue: 200033 },
      { customerId: 'c1', totalRevenue: 300034 },
    ];

    const aggregated = engine.aggregateRecords({
      records,
      dimensions: ['customerId'],
      measures: [{ name: 'totalRevenue', aggregation: 'SUM' }],
      timeZone: 'UTC',
      definition: def,
    });

    expect(aggregated.length).toBe(1);
    // 100033 + 200033 + 300034 = 600100 cents exactly
    expect(aggregated[0].sum_totalRevenue).toBe(600100);
  });

  it('INV-503: safely converts AST to Prisma where clauses without raw SQL', () => {
    const ast = {
      and: [
        { field: 'currency', operator: 'eq' as const, value: 'USD' },
        {
          field: 'status',
          operator: 'in' as const,
          value: ['COMPLETED', 'SHIPPED'],
        },
      ],
    };

    const where = engine.compileAstToPrismaWhere(ast);
    expect(where).toEqual({
      AND: [{ currency: 'USD' }, { status: { in: ['COMPLETED', 'SHIPPED'] } }],
    });
  });
});
