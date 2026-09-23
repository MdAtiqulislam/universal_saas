import { DataOperationRegistryService } from '../registry/data-operation.registry';
import { DataImportService } from '../services/data-import.service';
import { DataExportService } from '../services/data-export.service';
import { DataOperationJobsService } from '../services/data-operation-jobs.service';
import { CsvParserUtil } from '../utils/csv-parser.util';
import {
  DataImportMode,
  DataDuplicateStrategy,
  DataOperationStatus,
  DataOperationType,
} from '@prisma/client';

describe('Data Operations Performance Benchmarks', () => {
  let registry: DataOperationRegistryService;
  let importService: DataImportService;
  let exportService: DataExportService;
  let jobsService: DataOperationJobsService;
  let mockPrisma: any;

  beforeAll(() => {
    registry = new DataOperationRegistryService();

    // 10,000 synthetic database records for export
    const syntheticDbRecords = Array.from({ length: 10000 }, (_, i) => ({
      id: `c-${i}`,
      name: `Customer ${i}`,
      email: `customer_${i}@example.com`,
      phone: `555-${String(i).padStart(4, '0')}`,
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01'),
    }));

    mockPrisma = {
      customer: {
        findMany: jest.fn().mockResolvedValue(syntheticDbRecords),
        create: jest.fn().mockResolvedValue({ id: 'new-id' }),
        update: jest.fn().mockResolvedValue({ id: 'upd-id' }),
      },
      dataOperationJob: {
        create: jest.fn().mockImplementation((args) => ({
          id: 'job-bench-1',
          completedBatches: [],
          successfulRows: 0,
          failedRows: 0,
          skippedRows: 0,
          ...args.data,
        })),
        update: jest.fn().mockImplementation((args) => ({
          id: args.where.id,
          ...args.data,
        })),
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-bench-1',
          status: DataOperationStatus.PROCESSING,
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'job-bench-1',
          organizationId: 'org-bench',
          operationKey: 'crm.customer.export',
          status: DataOperationStatus.COMPLETED,
          format: 'CSV',
          resultSummary: { fileContent: 'mock' },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'job-bench-1',
          organizationId: 'org-bench',
          operationKey: 'crm.customer.import',
          status: DataOperationStatus.COMPLETED,
          totalRows: 10000,
          processedRows: 10000,
          successfulRows: 10000,
          failedRows: 0,
          completedBatches: [],
        }),
      },
      dataOperationBatch: {
        upsert: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        update: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      dataOperationError: {
        create: jest.fn().mockResolvedValue({ id: 'err-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    const quotaService: any = {
      assertQuota: jest.fn().mockResolvedValue(undefined),
      withConcurrentSlot: jest.fn().mockImplementation((_org: string, callback: () => unknown) => callback()),
    };
    const notificationService: any = {
      notifyJobCompletion: jest.fn().mockResolvedValue(undefined),
      notifyJobFailure: jest.fn().mockResolvedValue(undefined),
    };
    const audit: any = { record: jest.fn().mockResolvedValue(undefined) };
    const jobService: any = {
      createJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };
    const idempotency: any = {
      start: jest.fn().mockResolvedValue({ isReplay: false }),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    };

    importService = new DataImportService(
      mockPrisma,
      registry,
      quotaService,
      notificationService,
      audit,
      idempotency,
    );

    exportService = new DataExportService(
      mockPrisma,
      registry,
      quotaService,
      notificationService,
      audit,
      jobService,
      idempotency,
    );

    jobsService = new DataOperationJobsService(mockPrisma, audit);
  });

  // Benchmark 1: 10,000-row CSV validation & parsing
  it('Workload 1: 10,000-row CSV validation & parsing', () => {
    const rows = ['name,email,phone'];
    for (let i = 0; i < 10000; i++) {
      rows.push(`Customer ${i},customer_${i}@example.com,555-0100`);
    }
    const csvContent = rows.join('\r\n');

    const start = performance.now();
    const parsed = CsvParserUtil.parse(csvContent);
    const durationMs = performance.now() - start;

    expect(parsed.rows.length).toBe(10000);
    expect(parsed.headers).toEqual(['name', 'email', 'phone']);
    expect(durationMs).toBeLessThan(100); // target < 100ms
  });

  // Benchmark 2: 10,000-row import transformation
  it('Workload 2: 10,000-row import transformation', async () => {
    const rawRows = Array.from({ length: 10000 }, (_, i) => ({
      name: `  Acme Corp ${i}  `,
      email: `  USER_${i}@DOMAIN.COM  `,
      phone: '+1 (555) 019-2834',
    }));

    const def = registry.get('crm.customer.import');
    const start = performance.now();
    const results = await importService.validateAndTransformRows(
      'org-bench',
      def,
      rawRows,
      DataImportMode.CREATE_ONLY,
      DataDuplicateStrategy.FAIL,
    );
    const durationMs = performance.now() - start;

    expect(results.length).toBe(10000);
    expect(results[0].transformed.name).toBe('Acme Corp 0');
    expect(results[0].transformed.email).toBe('user_0@domain.com');
    expect(durationMs).toBeLessThan(1000); // target < 200ms in isolation, < 1000ms under heavy parallel test load
  });

  // Benchmark 3: 10,000-row dry-run preview
  it('Workload 3: 10,000-row dry-run preview', async () => {
    const rows = ['name,email,phone'];
    for (let i = 0; i < 10000; i++) {
      rows.push(`Customer ${i},customer_${i}@example.com,555-0100`);
    }
    const csvContent = rows.join('\r\n');

    const start = performance.now();
    const preview = await importService.preview({
      organizationId: 'org-bench',
      operationKey: 'crm.customer.import',
      fileContent: csvContent,
      userPermissions: [
        'data_operations.import.preview',
        'crm.customers.manage',
      ],
      dryRun: true,
    });
    const durationMs = performance.now() - start;

    expect(preview.totalRows).toBe(10000);
    expect(preview.validRows).toBe(10000);
    expect(preview.invalidRows).toBe(0);
    expect(mockPrisma.customer.create).not.toHaveBeenCalled();
    expect(durationMs).toBeLessThan(1000); // target < 250ms in isolation, < 1000ms under heavy parallel test load
  });

  // Benchmark 4: 10,000-row batched import commit
  it('Workload 4: 10,000-row batched import commit', async () => {
    const rows = ['name,email,phone'];
    for (let i = 0; i < 10000; i++) {
      rows.push(`Customer ${i},customer_${i}@example.com,555-0100`);
    }
    const csvContent = rows.join('\r\n');

    const start = performance.now();
    const commit = await importService.commit({
      organizationId: 'org-bench',
      operationKey: 'crm.customer.import',
      fileContent: csvContent,
      batchSize: 250,
      userPermissions: [
        'data_operations.import.execute',
        'crm.customers.manage',
      ],
    });
    const durationMs = performance.now() - start;

    expect(commit.totalRows).toBe(10000);
    expect(commit.successfulRows).toBe(10000);
    expect(durationMs).toBeLessThan(1500); // target < 500ms in isolation, < 1500ms under heavy parallel test load
  });

  // Benchmark 5: 10,000-row export
  it('Workload 5: 10,000-row export serialization', async () => {
    const start = performance.now();
    const result = (await exportService.export({
      organizationId: 'org-bench',
      operationKey: 'crm.customer.export',
      userPermissions: ['crm.customers.view', 'data_operations.export.execute'],
      limit: 10000,
    })) as any;
    const durationMs = performance.now() - start;

    expect(result.rowCount).toBe(10000);
    expect(result.fileContent.length).toBeGreaterThan(100000);
    expect(durationMs).toBeLessThan(1000); // target < 200ms in isolation, < 1000ms under heavy parallel test load
  });

  // Benchmark 6: Concurrent bounded import jobs
  it('Workload 6: Concurrent bounded import jobs', async () => {
    const rows = ['name,email\nCorp A,a@test.com\nCorp B,b@test.com'];
    const csvContent = rows.join('\r\n');

    const start = performance.now();
    const jobPromises = Array.from({ length: 5 }, (_, i) =>
      importService.preview({
        organizationId: `org-bench-${i}`,
        operationKey: 'crm.customer.import',
        fileContent: csvContent,
        userPermissions: [
          'data_operations.import.preview',
          'crm.customers.manage',
        ],
      }),
    );
    const results = await Promise.all(jobPromises);
    const durationMs = performance.now() - start;

    expect(results.length).toBe(5);
    expect(results.every((r) => r.totalRows === 2)).toBe(true);
    expect(durationMs).toBeLessThan(500);
  });

  // Benchmark 7: Repeated operation-status lookup
  it('Workload 7: Repeated operation-status lookup', async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await jobsService.getJob('org-bench', 'job-bench-1');
    }
    const avgDurationMs = (performance.now() - start) / 100;

    expect(avgDurationMs).toBeLessThan(1); // sub-millisecond status check
  });
});
