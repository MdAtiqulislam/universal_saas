import { ReportSchedulingService } from '../services/report-scheduling.service';
import { ReportExportService } from '../services/report-export.service';
import { ReportScheduleFrequency, ExportFormat } from '@prisma/client';

describe('ReportSchedulingService & ReportExportService (INV-510, INV-511)', () => {
  let schedulingService: ReportSchedulingService;
  let exportService: ReportExportService;
  let mockSchedulesRepo: any;
  let mockSavedReportsService: any;
  let mockExecutionService: any;
  let mockQueryEngine: any;

  beforeEach(() => {
    mockSchedulesRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      listSchedules: jest.fn(),
    };

    mockSavedReportsService = {
      getReport: jest.fn(),
    };

    mockExecutionService = {
      executeSavedReport: jest.fn(),
    };

    mockQueryEngine = {
      execute: jest.fn(),
    };

    schedulingService = new ReportSchedulingService(
      mockSchedulesRepo,
      mockSavedReportsService,
      mockExecutionService,
    );

    exportService = new ReportExportService(mockQueryEngine);
  });

  describe('ReportScheduling (INV-510)', () => {
    it('calculates daily next run at 00:00:00 UTC next day', () => {
      const nextRun = schedulingService.calculateNextRun(
        ReportScheduleFrequency.DAILY,
      );
      expect(nextRun.getUTCHours()).toBe(0);
      expect(nextRun.getUTCMinutes()).toBe(0);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it('calculates weekly next run 7 days in future', () => {
      const nextRun = schedulingService.calculateNextRun(
        ReportScheduleFrequency.WEEKLY,
      );
      const diffDays = Math.round(
        (nextRun.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(8);
    });

    it('creates schedule linking savedReport in tenant', async () => {
      mockSavedReportsService.getReport.mockResolvedValue({ id: 'rep-1' });
      mockSchedulesRepo.create.mockResolvedValue({
        id: 'sch-1',
        frequency: ReportScheduleFrequency.DAILY,
      });

      const result = await schedulingService.createSchedule({
        organizationId: 'org-1',
        dto: {
          savedReportId: 'rep-1',
          frequency: ReportScheduleFrequency.DAILY,
          recipients: ['user@example.com'],
        },
      });

      expect(result.id).toBe('sch-1');
      expect(mockSchedulesRepo.create).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          frequency: ReportScheduleFrequency.DAILY,
        }),
      );
    });
  });

  describe('ReportExport (INV-511)', () => {
    it('converts records to valid RFC 4180 CSV with escaped quotes and commas', () => {
      const rows = [
        { name: 'Acme, Inc.', status: 'ACTIVE', note: 'He said "Hello"' },
        { name: 'Simple Corp', status: 'INACTIVE', note: 'Normal' },
      ];

      const csv = exportService.convertToCsv(rows);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('name,status,note');
      expect(lines[1]).toBe('"Acme, Inc.",ACTIVE,"He said ""Hello"""');
      expect(lines[2]).toBe('Simple Corp,INACTIVE,Normal');
    });

    it('exports JSON format correctly', async () => {
      mockQueryEngine.execute.mockResolvedValue({
        data: [{ id: '1', amount: 100 }],
        meta: {
          definitionKey: 'sales.revenue',
          totalRows: 1,
          executionTimeMs: 5,
        },
      });

      const exportRes = await exportService.exportData({
        organizationId: 'org-1',
        exportDto: {
          format: ExportFormat.JSON,
          query: { definitionKey: 'sales.revenue' },
        },
      });

      expect(exportRes.format).toBe(ExportFormat.JSON);
      expect(exportRes.contentType).toBe('application/json');
      expect(JSON.parse(exportRes.data)).toEqual([{ id: '1', amount: 100 }]);
    });
  });
});
