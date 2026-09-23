import { ForbiddenException } from '@nestjs/common';
import { DataOperationsController } from '../controllers/data-operations.controller';

describe('DataOperationsController public execution path', () => {
  const registry = { list: jest.fn(), get: jest.fn() } as any;
  const exportService = { export: jest.fn().mockResolvedValue({ jobId: 'export-1' }) } as any;
  const importService = {
    preview: jest.fn().mockResolvedValue({ jobId: 'preview-1' }),
    commit: jest.fn().mockResolvedValue({ jobId: 'import-1' }),
  } as any;
  const jobsService = {} as any;
  const controller = new DataOperationsController(
    registry,
    exportService,
    importService,
    jobsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('INV-549: delegates export with tenant, permissions, limits, and idempotency', async () => {
    await controller.exportData(
      {
        operationKey: 'crm.customer.export',
        fields: ['name'],
        limit: 25,
        idempotencyKey: 'idem-export-1',
      } as any,
      { organizationId: 'org-a' } as any,
      { user: { id: 'user-a', permissions: ['data_operations.export.execute'] } } as any,
    );

    expect(exportService.export).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-a',
      userPermissions: ['data_operations.export.execute'],
      limit: 25,
      idempotencyKey: 'idem-export-1',
    }));
  });

  it('INV-549: delegates import to the shared service with tenant and permissions', async () => {
    await controller.commitImport(
      {
        operationKey: 'crm.customer.import',
        fileContent: 'name,email\nAcme,acme@test.com',
        batchSize: 25,
        idempotencyKey: 'idem-import-1',
      } as any,
      { organizationId: 'org-a' } as any,
      { user: { id: 'user-a', permissions: ['data_operations.import.execute'] } } as any,
    );

    expect(importService.commit).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-a',
      userPermissions: ['data_operations.import.execute'],
      batchSize: 25,
      idempotencyKey: 'idem-import-1',
    }));
  });

  it('INV-527/INV-549: refuses public execution without tenant context', async () => {
    await expect(controller.exportData({ operationKey: 'crm.customer.export' } as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(exportService.export).not.toHaveBeenCalled();
  });
});
