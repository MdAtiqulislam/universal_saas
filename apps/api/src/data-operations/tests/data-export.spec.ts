import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataExportService } from '../services/data-export.service';
import { DataOperationRegistryService } from '../registry/data-operation.registry';
import { DataOperationQuotaService } from '../services/data-operation-quota.service';
import { DataOperationNotificationService } from '../services/data-operation-notification.service';
import { FileSecurityUtil } from '../utils/file-security.util';

describe('DataExportService', () => {
  let exportService: DataExportService;
  let mockPrisma: any;
  let mockRegistry: DataOperationRegistryService;
  let mockQuotaService: any;
  let mockNotificationService: any;
  let mockAudit: any;
  let mockJobService: any;
  let mockIdempotency: any;

  beforeEach(() => {
    mockRegistry = new DataOperationRegistryService();

    mockPrisma = {
      dataOperationJob: {
        create: jest.fn().mockImplementation((args) => ({
          id: 'job-exp-123',
          ...args.data,
        })),
        update: jest.fn().mockImplementation((args) => ({
          id: args.where.id,
          ...args.data,
        })),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'job-exp-123',
          organizationId: 'org-tenant-1',
          operationKey: 'crm.customer.export',
          operationType: 'EXPORT',
          totalRows: 2,
          processedRows: 2,
          successfulRows: 2,
          failedRows: 0,
        }),
      },
      customer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c-1',
            name: 'Acme Corp',
            email: 'billing@acme.com',
            phone: '555-0100',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01'),
          },
          {
            id: 'c-2',
            name: "=cmd|' /C calc'!A0", // formula injection attempt
            email: 'danger@test.com',
            phone: '555-0101',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-02'),
          },
        ]),
      },
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

    mockJobService = {
      createJob: jest.fn().mockResolvedValue({ id: 'bg-job-1' }),
    };
    mockIdempotency = {
      start: jest.fn().mockResolvedValue({ isReplay: false }),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    };

    exportService = new DataExportService(
      mockPrisma,
      mockRegistry,
      mockQuotaService,
      mockNotificationService,
      mockAudit,
      mockJobService,
      mockIdempotency,
    );
  });

  it('INV-539/INV-549: replays a completed export idempotency key without creating a job', async () => {
    mockIdempotency.start.mockResolvedValue({
      isReplay: true,
      responseBody: { jobId: 'prior-job', rowCount: 2 },
    });

    const result = await exportService.export({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.export',
      idempotencyKey: 'same-export-request',
      userPermissions: ['crm.customers.view', 'data_operations.export.execute'],
    });

    expect(result).toEqual({ jobId: 'prior-job', rowCount: 2 });
    expect(mockPrisma.dataOperationJob.create).not.toHaveBeenCalled();
  });

  // INV-528: Tenant isolation
  it('INV-528: Data exports cannot return records outside the caller tenant', async () => {
    await exportService.export({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.export',
      userPermissions: ['crm.customers.view', 'data_operations.export.execute'],
    });

    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-tenant-1' }),
      }),
    );
  });

  // INV-530: Operation permissions
  it('INV-530: should reject export if user lacks required permissions', async () => {
    await expect(
      exportService.export({
        organizationId: 'org-tenant-1',
        operationKey: 'crm.customer.export',
        userPermissions: ['unrelated.permission'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // INV-531: Exportable fields must belong to allowlist
  it('INV-531: should reject export with unknown fields', async () => {
    await expect(
      exportService.export({
        organizationId: 'org-tenant-1',
        operationKey: 'crm.customer.export',
        fields: ['name', 'unknown_field'],
        userPermissions: [
          'crm.customers.view',
          'data_operations.export.execute',
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // INV-533: Restricted fields require elevated permission
  it('INV-533: should reject export of restricted fields without elevated permission', async () => {
    await expect(
      exportService.export({
        organizationId: 'org-tenant-1',
        operationKey: 'crm.customer.export',
        fields: ['name', 'taxId'], // taxId is restricted
        userPermissions: [
          'crm.customers.view',
          'data_operations.export.execute',
        ],
      }),
    ).rejects.toThrow(ForbiddenException);

    // Should succeed with elevated permission
    await expect(
      exportService.export({
        organizationId: 'org-tenant-1',
        operationKey: 'crm.customer.export',
        fields: ['name', 'taxId'],
        userPermissions: [
          'crm.customers.view',
          'data_operations.export.execute',
          'data_operations.restricted_fields.export',
        ],
      }),
    ).resolves.toBeDefined();
  });

  // INV-534: CSV formula injection defense
  it('INV-534: should sanitize formula injection characters in CSV export', async () => {
    const res = (await exportService.export({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.export',
      format: 'CSV',
      userPermissions: ['crm.customers.view', 'data_operations.export.execute'],
    })) as any;

    expect(res.fileContent).toBeDefined();
    // Verify that =cmd is prefixed with single quote
    expect(res.fileContent).toContain("'=cmd");
    // Verify it doesn't start with raw =cmd
    expect(res.fileContent).not.toContain('"=cmd');
  });

  // JSON format
  it('should support JSON export format', async () => {
    const res = (await exportService.export({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.export',
      format: 'JSON',
      userPermissions: ['crm.customers.view', 'data_operations.export.execute'],
    })) as any;

    expect(res.format).toBe('JSON');
    const parsed = JSON.parse(res.fileContent);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
  });

  // Deterministic ordering
  it('should request deterministic ordering by identity key', async () => {
    await exportService.export({
      organizationId: 'org-tenant-1',
      operationKey: 'crm.customer.export',
      userPermissions: ['crm.customers.view', 'data_operations.export.execute'],
    });

    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { email: 'asc' },
      }),
    );
  });
});
