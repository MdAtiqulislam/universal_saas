import { Test, TestingModule } from '@nestjs/testing';
import { JobService } from './job.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('JobService (Milestone M36)', () => {
  let service: JobService;
  let prisma: any;

  const mockOrgId = 'org-job-1';

  beforeEach(async () => {
    prisma = {
      backgroundJob: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JobService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<JobService>(JobService);
  });

  it('should enqueue a new background job with PENDING status', async () => {
    const mockJob = {
      id: 'job-1',
      organizationId: mockOrgId,
      jobType: 'FINANCIAL_RECONCILIATION',
      status: 'PENDING',
    };
    prisma.backgroundJob.create.mockResolvedValue(mockJob);

    const job = await service.createJob(mockOrgId, {
      jobType: 'FINANCIAL_RECONCILIATION',
      payload: { periodId: 'p-1' },
    });

    expect(job).toEqual(mockJob);
    expect(prisma.backgroundJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          jobType: 'FINANCIAL_RECONCILIATION',
          status: 'PENDING',
        }),
      }),
    );
  });

  it('should execute registered handler and mark job as COMPLETED', async () => {
    const mockPendingJob = {
      id: 'job-1',
      organizationId: mockOrgId,
      jobType: 'REPORT_EXPORT',
      status: 'PENDING',
      payload: { reportName: 'revenue_forecast' },
    };

    prisma.backgroundJob.findMany.mockResolvedValue([mockPendingJob]);
    prisma.backgroundJob.update.mockResolvedValue({});

    let executed = false;
    service.registerHandler('REPORT_EXPORT', async (payload, onProgress) => {
      await onProgress(50);
      executed = true;
      return { downloadUrl: 'https://s3.example.com/report.pdf' };
    });

    await service.processNextJobs(1);

    expect(executed).toBe(true);
    expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          progress: 100,
        }),
      }),
    );
  });
});
