import { SavedReportsService } from '../services/saved-reports.service';
import { ReportExecutionService } from '../services/report-execution.service';
import { ReportExecutionStatus, ReportVisibility } from '@prisma/client';

describe('SavedReportsService & ReportExecutionService (INV-506, INV-509)', () => {
  let savedReportsService: SavedReportsService;
  let executionService: ReportExecutionService;
  let mockReportRepo: any;
  let mockExecutionRepo: any;
  let mockQueryEngine: any;

  beforeEach(() => {
    mockReportRepo = {
      findById: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockExecutionRepo = {
      create: jest.fn(),
      update: jest.fn(),
      listExecutions: jest.fn(),
    };

    mockQueryEngine = {
      execute: jest.fn(),
    };

    savedReportsService = new SavedReportsService(
      mockReportRepo,
      mockQueryEngine,
    );
    executionService = new ReportExecutionService(
      mockExecutionRepo,
      savedReportsService,
      mockQueryEngine,
    );
  });

  it('INV-506: creates a saved report with valid parameters and tenant scope', async () => {
    mockReportRepo.create.mockResolvedValue({
      id: 'rep-1',
      organizationId: 'org-1',
      ownerUserId: 'u1',
      definitionKey: 'sales.revenue',
      name: 'Q1 Revenue',
      visibility: ReportVisibility.PRIVATE,
    });

    const result = await savedReportsService.createReport({
      organizationId: 'org-1',
      userId: 'u1',
      dto: {
        definitionKey: 'sales.revenue',
        name: 'Q1 Revenue',
        dimensions: ['customerId'],
      },
    });

    expect(result.id).toBe('rep-1');
    expect(mockReportRepo.create).toHaveBeenCalledWith(
      'org-1',
      'u1',
      expect.anything(),
    );
  });

  it('INV-509: tracks execution lifecycle from RUNNING to COMPLETED', async () => {
    mockReportRepo.findById.mockResolvedValue({
      id: 'rep-1',
      organizationId: 'org-1',
      ownerUserId: 'u1',
      definitionKey: 'sales.revenue',
      dimensions: ['customerId'],
      measures: [],
      visibility: ReportVisibility.ORGANIZATION,
      shares: [],
      limit: 50,
      offset: 0,
    });

    mockExecutionRepo.create.mockResolvedValue({
      id: 'exec-1',
      executionId: 'uuid-exec-1',
      status: ReportExecutionStatus.RUNNING,
    });

    mockQueryEngine.execute.mockResolvedValue({
      data: [{ customerId: 'c1', total: 100 }],
      meta: { totalRows: 1, executionTimeMs: 15 },
    });

    mockExecutionRepo.update.mockResolvedValue({
      id: 'exec-1',
      executionId: 'uuid-exec-1',
      status: ReportExecutionStatus.COMPLETED,
      rowCount: 1,
      durationMs: 15,
    });

    const { execution, result } = await executionService.executeSavedReport({
      savedReportId: 'rep-1',
      organizationId: 'org-1',
      userId: 'u1',
    });

    expect(mockExecutionRepo.create).toHaveBeenCalled();
    expect(mockExecutionRepo.update).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: ReportExecutionStatus.COMPLETED,
        rowCount: 1,
      }),
    );
    expect(result.data.length).toBe(1);
    expect(execution.status).toBe(ReportExecutionStatus.COMPLETED);
  });
});
