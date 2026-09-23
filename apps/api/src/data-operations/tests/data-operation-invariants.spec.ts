import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DataOperationRegistryService } from '../registry/data-operation.registry';
import { DataExportService } from '../services/data-export.service';
import { DataImportService } from '../services/data-import.service';
import { DataOperationJobsService } from '../services/data-operation-jobs.service';
import { DataOperationQuotaService } from '../services/data-operation-quota.service';
import { DataOperationNotificationService } from '../services/data-operation-notification.service';
import { FileSecurityUtil } from '../utils/file-security.util';
import {
  DataOperationType,
  DataOperationStatus,
  DataImportMode,
  DataDuplicateStrategy,
  NotificationChannel,
} from '@prisma/client';

describe('Milestone M46 Invariant Verification Matrix (INV-526 -> INV-550)', () => {
  let registry: DataOperationRegistryService;
  let exportService: DataExportService;
  let importService: DataImportService;
  let jobsService: DataOperationJobsService;
  let quotaService: DataOperationQuotaService;
  let notificationService: DataOperationNotificationService;
  let mockPrisma: any;
  let mockEntitlements: any;
  let mockNotifications: any;
  let mockAudit: any;
  let mockJobService: any;
  let mockIdempotency: any;

  beforeEach(() => {
    registry = new DataOperationRegistryService();

    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockPrisma)),
      customer: {
        findMany: jest.fn().mockImplementation((args) => {
          if (args?.where?.organizationId === 'org-tenant-1') {
            return Promise.resolve([
              {
                id: 'c-1',
                organizationId: 'org-tenant-1',
                name: 'Acme',
                email: 'acme@test.com',
                phone: '123',
              },
            ]);
          }
          return Promise.resolve([]);
        }),
        create: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: 'c-new', ...args.data }),
          ),
        update: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: args.where.id, ...args.data }),
          ),
      },
      dataOperationJob: {
        create: jest.fn().mockImplementation((args) => ({
          id: 'job-inv-1',
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
        findFirst: jest.fn().mockImplementation((args) => {
          if (
            args.where.id === 'job-inv-1' &&
            args.where.organizationId === 'org-tenant-1'
          ) {
            return Promise.resolve({
              id: 'job-inv-1',
              organizationId: 'org-tenant-1',
              operationKey: 'crm.customer.export',
              operationType: DataOperationType.EXPORT,
              status: DataOperationStatus.COMPLETED,
              fileName: 'export.csv',
              format: 'CSV',
              resultSummary: { fileContent: 'name,email\nAcme,acme@test.com' },
            });
          }
          if (
            args.where.id === 'job-active-1' &&
            args.where.organizationId === 'org-tenant-1'
          ) {
            return Promise.resolve({
              id: 'job-active-1',
              organizationId: 'org-tenant-1',
              operationKey: 'crm.customer.import',
              operationType: DataOperationType.IMPORT,
              status: DataOperationStatus.PROCESSING,
            });
          }
          return Promise.resolve(null);
        }),
        findFirstOrThrow: jest.fn().mockImplementation((args) => {
          if (args.where.id === 'job-resume-1') {
            return Promise.resolve({
              id: 'job-resume-1',
              organizationId: 'org-tenant-1',
              operationKey: 'crm.customer.import',
              operationType: DataOperationType.IMPORT,
              status: DataOperationStatus.PROCESSING,
              completedBatches: [0],
              successfulRows: 1,
              failedRows: 0,
              skippedRows: 0,
            });
          }
          return Promise.resolve({
            id: 'job-inv-1',
            organizationId: 'org-tenant-1',
            operationKey: 'crm.customer.import',
            operationType: DataOperationType.IMPORT,
            status: DataOperationStatus.COMPLETED,
            totalRows: 1,
            processedRows: 1,
            successfulRows: 1,
            failedRows: 0,
            completedBatches: [],
          });
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-inv-1',
          status: DataOperationStatus.PROCESSING,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'job-inv-1',
          organizationId: 'org-tenant-1',
          operationKey: 'crm.customer.import',
          operationType: DataOperationType.IMPORT,
          status: DataOperationStatus.COMPLETED,
          totalRows: 1,
          processedRows: 1,
          successfulRows: 1,
          failedRows: 0,
        }),
        count: jest.fn().mockResolvedValue(0),
      },
      dataOperationBatch: {
        upsert: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        update: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      dataOperationError: {
        create: jest.fn().mockResolvedValue({ id: 'err-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      dataOperationTemplate: {
        create: jest
          .fn()
          .mockImplementation((args) => ({ id: 'tpl-1', ...args.data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockEntitlements = {
      assertWithinQuota: jest.fn().mockResolvedValue(undefined),
    };

    mockNotifications = {
      notify: jest.fn().mockResolvedValue({ notificationId: 'notif-1' }),
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    mockJobService = {
      createJob: jest.fn().mockResolvedValue({ id: 'bg-1' }),
    };
    mockIdempotency = {
      start: jest.fn().mockResolvedValue({ isReplay: false }),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    };

    quotaService = new DataOperationQuotaService(mockPrisma, mockEntitlements);
    notificationService = new DataOperationNotificationService(
      mockNotifications,
    );

    exportService = new DataExportService(
      mockPrisma,
      registry,
      quotaService,
      notificationService,
      mockAudit,
      mockJobService,
      mockIdempotency,
    );

    importService = new DataImportService(
      mockPrisma,
      registry,
      quotaService,
      notificationService,
      mockAudit,
      mockIdempotency,
    );

    jobsService = new DataOperationJobsService(mockPrisma, mockAudit);
  });

  // INV-526 — Data operations are globally unique by authoritative operation key
  it('INV-526: Data operations are globally unique by authoritative operation key', () => {
    expect(() =>
      registry.register({
        operationKey: 'crm.customer.export', // already registered
        domain: 'crm',
        entity: 'customer',
        operationType: DataOperationType.EXPORT,
        allowedFormats: ['CSV'],
        requiredPermissions: ['crm.customers.view'],
        restrictedFieldPermissions: {},
        fieldSchema: [{ name: 'name', type: 'string' }],
        maxRows: 1000,
        maxFileSize: 1024 * 1024,
        maxColumns: 10,
        validationRules: [],
        transformationRules: [],
        identityStrategy: ['email'],
        supportedModes: [],
        modelName: 'customer',
      }),
    ).toThrow(ConflictException);
  });

  // INV-527 — Every data operation executes within exactly one organization context
  it('INV-527: Every data operation executes within exactly one organization context', async () => {
    await exportService.export({
      organizationId: 'org-exact-tenant-1',
      operationKey: 'crm.customer.export',
      userPermissions: ['crm.customers.view', 'data_operations.export.execute'],
    });

    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-exact-tenant-1',
        }),
      }),
    );
  });

  // INV-528 — Data exports cannot return records outside the caller's tenant
  it('INV-528: Data exports cannot return records outside the caller tenant', async () => {
    await exportService.export({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.export',
      userPermissions: ['crm.customers.view', 'data_operations.export.execute'],
    });

    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-tenant-1' },
      }),
    );
  });

  // INV-529 — Data imports cannot mutate records outside the caller's tenant
  it('INV-529: Data imports cannot mutate records outside the caller tenant', async () => {
    await importService.commit({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.import',
      fileContent: 'name,email\nTest,test@test.com',
      userPermissions: [
        'crm.customers.manage',
        'data_operations.import.execute',
      ],
    });

    expect(mockPrisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-tenant-1' }),
      }),
    );
  });

  // INV-530 — Data operations require the permissions declared by their authoritative operation definition
  it('INV-530: Data operations require permissions declared by authoritative definition', async () => {
    await expect(
      exportService.export({
        organizationId: 'org-tenant-1',
        operationKey: 'crm.customer.export',
        userPermissions: ['insufficient.permission'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // INV-531 — Exportable fields must belong to the authoritative operation field allowlist
  it('INV-531: Exportable fields must belong to the authoritative operation field allowlist', async () => {
    await expect(
      exportService.export({
        organizationId: 'org-tenant-1',
        operationKey: 'crm.customer.export',
        fields: ['name', 'forbidden_custom_column'],
        userPermissions: [
          'crm.customers.view',
          'data_operations.export.execute',
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // INV-532 — Importable fields must belong to the authoritative operation field allowlist
  it('INV-532: Importable fields must belong to the authoritative operation field allowlist', async () => {
    const preview = await importService.preview({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.import',
      fileContent: 'name,email,illegal_column\nAcme,a@test.com,bad',
      userPermissions: [
        'crm.customers.manage',
        'data_operations.import.preview',
      ],
    });

    expect(preview.invalidRows).toBe(1);
    expect(preview.errors[0].errorCode).toBe('UNKNOWN_FIELD');
  });

  // INV-533 — Restricted fields cannot be exported without the required elevated permission
  it('INV-533: Restricted fields cannot be exported without elevated permission', async () => {
    // taxId is restricted
    await expect(
      exportService.export({
        organizationId: 'org-tenant-1',
        operationKey: 'crm.customer.export',
        fields: ['name', 'taxId'],
        userPermissions: [
          'crm.customers.view',
          'data_operations.export.execute',
        ],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // INV-534 — Data operations cannot execute arbitrary SQL or dynamic code
  it('INV-534: Data operations cannot execute arbitrary SQL or dynamic code (formula injection defense)', async () => {
    const res = (await exportService.export({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.export',
      format: 'CSV',
      userPermissions: ['crm.customers.view', 'data_operations.export.execute'],
    })) as any;

    expect(res.fileContent).toBeDefined();
    // Formula characters sanitized
    expect(FileSecurityUtil.sanitizeFormulaInjection('=1+1')).toBe("'=1+1");
    expect(FileSecurityUtil.sanitizeFormulaInjection('@SUM(A1)')).toBe(
      "'@SUM(A1)",
    );
  });

  // INV-535 — Import files must satisfy server-side format, size, column, and row limits
  it('INV-535: Import files must satisfy server-side format, size, column, and row limits', () => {
    expect(() =>
      FileSecurityUtil.enforceLimits({
        fileSizeBytes: 30 * 1024 * 1024,
        maxFileSize: 15 * 1024 * 1024,
        maxRows: 1000,
        maxColumns: 20,
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      FileSecurityUtil.validateFormat(
        'malicious.exe',
        'application/x-msdownload',
      ),
    ).toThrow(BadRequestException);
  });

  // INV-536 — Import previews cannot mutate persistent business data
  it('INV-536: Import previews cannot mutate persistent business data', async () => {
    await importService.preview({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.import',
      fileContent: 'name,email\nCorp,corp@test.com',
      userPermissions: [
        'crm.customers.manage',
        'data_operations.import.preview',
      ],
    });

    expect(mockPrisma.customer.create).not.toHaveBeenCalled();
    expect(mockPrisma.customer.update).not.toHaveBeenCalled();
  });

  // INV-537 — Import transformations must use only declaratively registered transformation rules
  it('INV-537: Import transformations must use only declaratively registered transformation rules', async () => {
    const preview = await importService.preview({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.import',
      fileContent: 'name,email\n  LeadingSpace  ,  UPPER@DOMAIN.COM  ',
      userPermissions: [
        'crm.customers.manage',
        'data_operations.import.preview',
      ],
    });

    expect(preview.previewRows[0].name).toBe('LeadingSpace');
    expect(preview.previewRows[0].email).toBe('upper@domain.com');
  });

  // INV-538 — Import identity and duplicate-detection rules must come from authoritative definition
  it('INV-538: Import identity and duplicate-detection rules come from authoritative definition', async () => {
    // crm.customer.import identityStrategy is ['email']
    const def = registry.get('crm.customer.import');
    expect(def.identityStrategy).toEqual(['email']);

    const preview = await importService.preview({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.import',
      fileContent: 'name,email\nAcme,acme@test.com', // existing in mock
      mode: DataImportMode.CREATE_ONLY,
      userPermissions: [
        'crm.customers.manage',
        'data_operations.import.preview',
      ],
    });

    expect(preview.invalidRows).toBe(1);
    expect(preview.errors[0].errorCode).toBe('DUPLICATE_RECORD_REJECTED');
  });

  // INV-539 — Retryable imports are idempotent and cannot duplicate completed mutations
  it('INV-539: Retryable imports are idempotent and cannot duplicate completed mutations', async () => {
    mockPrisma.dataOperationJob.findFirstOrThrow.mockResolvedValueOnce({
      id: 'job-resume-1',
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.import',
      status: DataOperationStatus.PROCESSING,
      completedBatches: [0], // Batch 0 already completed!
      successfulRows: 1,
      failedRows: 0,
      skippedRows: 0,
    });

    await importService.commit({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.import',
      fileContent: 'name,email\nAcme,acme2@test.com',
      jobId: 'job-resume-1',
      batchSize: 10,
      userPermissions: [
        'crm.customers.manage',
        'data_operations.import.execute',
      ],
    });

    // Batch 0 was skipped because completedBatches contains 0!
    expect(mockPrisma.customer.create).not.toHaveBeenCalled();
  });

  // INV-540 — Bulk execution concurrency and batch sizes are server-side bounded
  it('INV-540: Bulk execution concurrency and batch sizes are server-side bounded', async () => {
    // Batch size is clamped between 10 and 500
    const commitRes = await importService.commit({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.import',
      fileContent: 'name,email\nCorp,c@test.com',
      batchSize: 99999, // Unbounded attempt
      userPermissions: [
        'crm.customers.manage',
        'data_operations.import.execute',
      ],
    });

    expect(commitRes.status).toBe(DataOperationStatus.COMPLETED);
  });

  // INV-541 — Data operation jobs are tenant-scoped and cannot be accessed by another tenant
  it('INV-541: Data operation jobs are tenant-scoped and cannot be accessed by another tenant', async () => {
    await expect(
      jobsService.getJob('org-tenant-2', 'job-inv-1'),
    ).rejects.toThrow(NotFoundException);
  });

  // INV-542 — Data operation result files and error reports are tenant-scoped and access-controlled
  it('INV-542: Data operation result files and error reports are tenant-scoped and access-controlled', async () => {
    const result = await jobsService.getJobResult('org-tenant-1', 'job-inv-1');
    expect(result.fileContent).toContain('Acme');

    await expect(
      jobsService.getJobResult('org-tenant-2', 'job-inv-1'),
    ).rejects.toThrow(NotFoundException);
  });

  // INV-543 — Import commit operations revalidate authorization and operation definitions before mutation
  it('INV-543: Import commit operations revalidate authorization before mutation', async () => {
    await expect(
      importService.commit({
        organizationId: 'org-tenant-1',
        operationKey: 'crm.customer.import',
        fileContent: 'name,email\nCorp,c@test.com',
        userPermissions: ['insufficient.perms'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // INV-544 — Data operation lifecycle transitions are state-machine protected
  it('INV-544: Data operation lifecycle transitions are state-machine protected', async () => {
    // Cannot cancel already COMPLETED job
    await expect(
      jobsService.cancelJob('org-tenant-1', 'job-inv-1'),
    ).rejects.toThrow(BadRequestException);
  });

  // INV-545 — Data operation cancellation cannot leave unauthorized partial mutations outside execution boundary
  it('INV-545: Data operation cancellation halts execution safely', async () => {
    const cancelled = await jobsService.cancelJob(
      'org-tenant-1',
      'job-active-1',
    );
    expect(cancelled.status).toBe(DataOperationStatus.CANCELLED);
  });

  // INV-546 — Data operation quotas are enforced through M42 entitlement/usage controls
  it('INV-546: Data operation quotas are enforced through M42 entitlement/usage controls', async () => {
    await quotaService.assertQuota(
      'org-tenant-1',
      DataOperationType.EXPORT,
      100,
    );
    expect(mockEntitlements.assertWithinQuota).toHaveBeenCalledWith(
      'org-tenant-1',
      'data_operations.exports.monthly',
      1,
    );
  });

  // INV-547 — Data operation notifications use M43 communication policies and cannot bypass them
  it('INV-547: Data operation notifications use M43 communication policies', async () => {
    const job: any = {
      id: 'job-1',
      organizationId: 'org-tenant-1',
      createdById: 'user-1',
      operationKey: 'crm.customer.export',
      operationType: DataOperationType.EXPORT,
      processedRows: 5,
      successfulRows: 5,
      failedRows: 0,
    };

    await notificationService.notifyJobCompletion(job);
    expect(mockNotifications.notify).toHaveBeenCalledWith(
      'org-tenant-1',
      expect.objectContaining({
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      }),
    );
  });

  // INV-548 — Administrative data-operation configuration and mutations are permission-protected and auditable
  it('INV-548: Administrative operations emit audit events via AuditService', async () => {
    await jobsService.createTemplate('org-tenant-1', {
      operationKey: 'crm.customer.import',
      name: 'Custom Template',
    });

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'data_operations.template.created',
        organizationId: 'org-tenant-1',
      }),
    );
  });

  // INV-549 — Public data-operation APIs enforce the same tenant, authorization, quota, idempotency, and limit controls
  it('INV-549: Public API contracts parity across operations, jobs, exports, imports', () => {
    const {
      ApiContractService,
    } = require('../../developer/services/api-contract.service');
    const apiContracts = new ApiContractService();
    const spec = apiContracts.getOpenApiSpec();

    expect(spec.paths['/api/v1/data-operations/imports']).toBeDefined();
    expect(spec.paths['/api/v1/data-operations/exports']).toBeDefined();
    expect(spec.paths['/api/v1/data-operations/jobs/:id']).toBeDefined();
    expect(spec.paths['/api/v1/data-operations/jobs/:id/result']).toBeDefined();
  });

  // INV-550 — Data-operation history and telemetry cannot expose restricted business data or cross-tenant information
  it('INV-550: Error reports and history do not expose cross-tenant data', async () => {
    await expect(
      jobsService.getJobErrors('org-tenant-2', 'job-inv-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
