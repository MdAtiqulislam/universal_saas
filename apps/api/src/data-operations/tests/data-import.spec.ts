import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataImportService } from '../services/data-import.service';
import { DataOperationRegistryService } from '../registry/data-operation.registry';
import { DataImportMode, DataOperationStatus } from '@prisma/client';

describe('DataImportService', () => {
  let importService: DataImportService;
  let mockPrisma: any;
  let mockRegistry: DataOperationRegistryService;
  let mockQuotaService: any;
  let mockNotificationService: any;
  let mockAudit: any;
  let mockIdempotency: any;

  beforeEach(() => {
    mockRegistry = new DataOperationRegistryService();

    mockPrisma = {
      dataOperationJob: {
        create: jest.fn().mockImplementation((args) => ({
          id: 'job-imp-123',
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
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'job-imp-123',
          organizationId: 'org-1',
          operationKey: 'crm.customer.import',
          status: DataOperationStatus.PREVIEWING,
          completedBatches: [],
          successfulRows: 0,
          failedRows: 0,
          skippedRows: 0,
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-imp-123',
          status: DataOperationStatus.PROCESSING,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'job-imp-123',
          organizationId: 'org-1',
          operationKey: 'crm.customer.import',
          status: DataOperationStatus.COMPLETED,
          totalRows: 1,
          successfulRows: 1,
          failedRows: 0,
        }),
      },
      dataOperationBatch: {
        upsert: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        update: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      dataOperationError: {
        create: jest.fn().mockResolvedValue({ id: 'err-1' }),
      },
      customer: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'c-existing-1', email: 'existing@test.com' },
          ]),
        create: jest.fn().mockResolvedValue({ id: 'c-new-1' }),
        update: jest.fn().mockResolvedValue({ id: 'c-existing-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    mockQuotaService = {
      assertQuota: jest.fn().mockResolvedValue(undefined),
      withConcurrentSlot: jest.fn().mockImplementation((_org: string, callback: () => unknown) => callback()),
    };

    mockNotificationService = {
      notifyJobCompletion: jest.fn().mockResolvedValue(undefined),
      notifyJobFailure: jest.fn().mockResolvedValue(undefined),
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    mockIdempotency = {
      start: jest.fn().mockResolvedValue({ isReplay: false }),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    };

    importService = new DataImportService(
      mockPrisma,
      mockRegistry,
      mockQuotaService,
      mockNotificationService,
      mockAudit,
      mockIdempotency,
    );
  });

  it('INV-539/INV-549: rejects a pending duplicate import idempotency key before job creation', async () => {
    mockIdempotency.start.mockRejectedValue(new ForbiddenException('duplicate request'));

    await expect(importService.commit({
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      fileContent: 'name,email\nDuplicate,duplicate@test.com',
      idempotencyKey: 'same-import-request',
      userPermissions: ['data_operations.import.execute', 'crm.customers.manage'],
    })).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.dataOperationJob.create).not.toHaveBeenCalled();
  });

  // INV-536: Dry-run preview produces metrics without persistent mutation
  it('INV-536: Import preview does not mutate business tables', async () => {
    const csvContent =
      'name,email\nAlpha Corp,alpha@test.com\nBeta LLC,beta@test.com';

    const preview = await importService.preview({
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      fileContent: csvContent,
      userPermissions: [
        'data_operations.import.preview',
        'crm.customers.manage',
      ],
      dryRun: true,
    });

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(2);
    expect(preview.plannedCreates).toBe(2);
    expect(preview.invalidRows).toBe(0);

    // Business table mutate methods MUST NOT be called!
    expect(mockPrisma.customer.create).not.toHaveBeenCalled();
    expect(mockPrisma.customer.update).not.toHaveBeenCalled();
  });

  // INV-532: Reject unknown import fields
  it('INV-532: should flag unknown fields during validation', async () => {
    const csvContent =
      'name,email,injected_hack\nAlpha Corp,alpha@test.com,danger';

    const preview = await importService.preview({
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      fileContent: csvContent,
      userPermissions: [
        'data_operations.import.preview',
        'crm.customers.manage',
      ],
    });

    expect(preview.invalidRows).toBe(1);
    expect(preview.errors[0].errorCode).toBe('UNKNOWN_FIELD');
  });

  // INV-537: Declarative transformations
  it('INV-537: should apply registered transformations (trim, toLowerCase)', async () => {
    const csvContent = 'name,email\n  Whitespace Corp  ,  LOWERCASE@TEST.COM  ';

    const preview = await importService.preview({
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      fileContent: csvContent,
      userPermissions: [
        'data_operations.import.preview',
        'crm.customers.manage',
      ],
    });

    expect(preview.previewRows[0].name).toBe('Whitespace Corp');
    expect(preview.previewRows[0].email).toBe('lowercase@test.com');
  });

  // INV-538: Duplicate detection & import modes
  it('INV-538: should detect duplicates using identityStrategy and respect CREATE_ONLY mode', async () => {
    // existing@test.com already exists in mock
    const csvContent = 'name,email\nExisting Corp,existing@test.com';

    const preview = await importService.preview({
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      fileContent: csvContent,
      mode: DataImportMode.CREATE_ONLY,
      userPermissions: [
        'data_operations.import.preview',
        'crm.customers.manage',
      ],
    });

    expect(preview.invalidRows).toBe(1);
    expect(preview.errors[0].errorCode).toBe('DUPLICATE_RECORD_REJECTED');
  });

  it('INV-538: should plan update for duplicate in UPSERT mode', async () => {
    const csvContent = 'name,email\nUpdated Corp,existing@test.com';

    const preview = await importService.preview({
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      fileContent: csvContent,
      mode: DataImportMode.UPSERT,
      userPermissions: [
        'data_operations.import.preview',
        'crm.customers.manage',
      ],
    });

    expect(preview.validRows).toBe(1);
    expect(preview.plannedUpdates).toBe(1);
  });

  // INV-529: Commit mutates within caller tenant
  it('INV-529: Commit strictly applies tenant organizationId to records', async () => {
    const csvContent = 'name,email\nNew Corp,new@test.com';

    await importService.commit({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.import',
      fileContent: csvContent,
      userPermissions: [
        'data_operations.import.execute',
        'crm.customers.manage',
      ],
    });

    expect(mockPrisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-tenant-1' }),
      }),
    );
  });

  // INV-543: Commit revalidates permissions
  it('INV-543: Commit revalidates caller permissions before mutation', async () => {
    const csvContent = 'name,email\nNew Corp,new@test.com';

    await expect(
      importService.commit({
        organizationId: 'org-tenant-1',
        operationKey: 'crm.customer.import',
        fileContent: csvContent,
        userPermissions: ['wrong.permission'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('INV-545: cancellation before the first batch begins commits no rows', async () => {
    mockPrisma.dataOperationJob.findUnique.mockResolvedValue({
      id: 'job-imp-123',
      status: DataOperationStatus.CANCELLED,
    });
    mockPrisma.dataOperationJob.findUniqueOrThrow.mockResolvedValue({
      id: 'job-imp-123',
      status: DataOperationStatus.CANCELLED,
      successfulRows: 0,
      failedRows: 0,
      skippedRows: 0,
    });

    const result = await importService.commit({
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      fileContent: 'name,email\nCancelled,cancelled@test.com',
      userPermissions: ['data_operations.import.execute', 'crm.customers.manage'],
    });

    expect(result.status).toBe(DataOperationStatus.CANCELLED);
    expect(mockPrisma.customer.create).not.toHaveBeenCalled();
  });

  it('INV-545: cancellation after a committed batch prevents later batches', async () => {
    mockPrisma.dataOperationJob.findUnique
      .mockResolvedValueOnce({ id: 'job-imp-123', status: DataOperationStatus.PROCESSING })
      .mockResolvedValueOnce({ id: 'job-imp-123', status: DataOperationStatus.CANCELLED });
    mockPrisma.dataOperationJob.findUniqueOrThrow.mockResolvedValue({
      id: 'job-imp-123',
      status: DataOperationStatus.CANCELLED,
      successfulRows: 10,
      failedRows: 0,
      skippedRows: 0,
    });
    const rows = ['name,email'];
    for (let index = 0; index < 11; index++) rows.push(`Customer ${index},customer${index}@test.com`);

    const result = await importService.commit({
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      fileContent: rows.join('\n'),
      batchSize: 10,
      userPermissions: ['data_operations.import.execute', 'crm.customers.manage'],
    });

    expect(result.status).toBe(DataOperationStatus.CANCELLED);
    expect(mockPrisma.customer.create).toHaveBeenCalledTimes(10);
  });

  it('INV-539/INV-545: cancelled jobs cannot be retried or resumed', async () => {
    mockPrisma.dataOperationJob.findFirstOrThrow.mockResolvedValue({
      id: 'job-imp-123',
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      status: DataOperationStatus.CANCELLED,
      completedBatches: [0],
      successfulRows: 10,
      failedRows: 0,
      skippedRows: 0,
    });

    await expect(importService.commit({
      organizationId: 'org-1',
      operationKey: 'crm.customer.import',
      jobId: 'job-imp-123',
      fileContent: 'name,email\nReplay,replay@test.com',
      userPermissions: ['data_operations.import.execute', 'crm.customers.manage'],
    })).rejects.toThrow(BadRequestException);
    expect(mockPrisma.customer.create).not.toHaveBeenCalled();
  });
});
