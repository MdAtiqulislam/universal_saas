import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataOperationJobsService } from '../services/data-operation-jobs.service';
import { DataOperationStatus, DataOperationType } from '@prisma/client';

describe('DataOperationJobsService', () => {
  let jobsService: DataOperationJobsService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      dataOperationJob: {
        findFirst: jest.fn().mockImplementation((args) => {
          if (
            args.where.id === 'job-1' &&
            args.where.organizationId === 'org-tenant-1'
          ) {
            return Promise.resolve({
              id: 'job-1',
              organizationId: 'org-tenant-1',
              operationKey: 'crm.customer.export',
              operationType: DataOperationType.EXPORT,
              status: DataOperationStatus.COMPLETED,
              format: 'CSV',
              fileName: 'customers.csv',
              resultSummary: { fileContent: 'id,name\n1,Acme' },
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
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation((args) => ({
          id: args.where.id,
          ...args.data,
        })),
      },
      dataOperationError: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'err-1',
            rowNumber: 3,
            fieldName: 'email',
            errorCode: 'INVALID_EMAIL',
            errorMessage: 'Email format invalid',
          },
        ]),
      },
      dataOperationTemplate: {
        create: jest.fn().mockImplementation((args) => ({
          id: 'tpl-1',
          ...args.data,
        })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    jobsService = new DataOperationJobsService(mockPrisma, mockAudit);
  });

  // INV-541: Jobs are tenant-scoped
  it('INV-541: should reject cross-tenant job access with NotFoundException', async () => {
    // Calling with org-tenant-2 for job belonging to org-tenant-1
    await expect(jobsService.getJob('org-tenant-2', 'job-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  // INV-542: Result files access-controlled
  it('INV-542: should retrieve result file only for tenant owner and completed job', async () => {
    const result = await jobsService.getJobResult('org-tenant-1', 'job-1');
    expect(result.fileContent).toBe('id,name\n1,Acme');
    expect(result.fileName).toBe('customers.csv');

    // Cross-tenant access rejected
    await expect(
      jobsService.getJobResult('org-tenant-2', 'job-1'),
    ).rejects.toThrow(NotFoundException);
  });

  // INV-544 / INV-545: Cancellation state machine
  it('INV-544/INV-545: should cancel active job but reject cancellation of completed job', async () => {
    // Active job can be cancelled
    const cancelled = await jobsService.cancelJob(
      'org-tenant-1',
      'job-active-1',
    );
    expect(cancelled.status).toBe(DataOperationStatus.CANCELLED);

    // Completed job cannot be cancelled
    await expect(
      jobsService.cancelJob('org-tenant-1', 'job-1'),
    ).rejects.toThrow(BadRequestException);
  });

  // Error report generation (INV-542, INV-550)
  it('INV-550: should generate sanitized CSV error report', async () => {
    const errorReport = await jobsService.getJobErrors('org-tenant-1', 'job-1');
    expect(errorReport.errors.length).toBe(1);
    expect(errorReport.csvContent).toContain(
      'rowNumber,fieldName,errorCode,errorMessage',
    );
    expect(errorReport.csvContent).toContain(
      '3,"email","INVALID_EMAIL","Email format invalid"',
    );
  });

  // Templates
  it('should create and list templates for tenant', async () => {
    const tpl = await jobsService.createTemplate('org-tenant-1', {
      operationKey: 'crm.customer.import',
      name: 'Default Customer Import',
    });
    expect(tpl.name).toBe('Default Customer Import');
    expect(mockAudit.record).toHaveBeenCalled();
  });
});
