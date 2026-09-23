import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Repositories
import { SavedReportsRepository } from './repositories/saved-reports.repository';
import { ReportExecutionsRepository } from './repositories/report-executions.repository';
import { ReportSchedulesRepository } from './repositories/report-schedules.repository';
import { DashboardsRepository } from './repositories/dashboards.repository';
import { AnalyticsUsageRepository } from './repositories/analytics-usage.repository';

// Services
import { TimeAnalyticsService } from './services/time-analytics.service';
import { AnalyticsQueryEngineService } from './services/analytics-query-engine.service';
import { SavedReportsService } from './services/saved-reports.service';
import { ReportExecutionService } from './services/report-execution.service';
import { ReportSchedulingService } from './services/report-scheduling.service';
import { ReportExportService } from './services/report-export.service';
import { DashboardsService } from './services/dashboards.service';
import { AnalyticsReportsService } from './services/analytics-reports.service';

// Controllers
import { AnalyticsQueryController } from './controllers/analytics-query.controller';
import { SavedReportsController } from './controllers/saved-reports.controller';
import { ReportSchedulesController } from './controllers/report-schedules.controller';
import { DashboardsController } from './controllers/dashboards.controller';
import { AnalyticsReportsController } from './controllers/analytics-reports.controller';

@Module({
  imports: [PrismaModule, CommonModule, NotificationsModule],
  controllers: [
    AnalyticsQueryController,
    SavedReportsController,
    ReportSchedulesController,
    DashboardsController,
    AnalyticsReportsController,
  ],
  providers: [
    // Repositories
    SavedReportsRepository,
    ReportExecutionsRepository,
    ReportSchedulesRepository,
    DashboardsRepository,
    AnalyticsUsageRepository,
    // Services
    TimeAnalyticsService,
    AnalyticsQueryEngineService,
    SavedReportsService,
    ReportExecutionService,
    ReportSchedulingService,
    ReportExportService,
    DashboardsService,
    AnalyticsReportsService,
  ],
  exports: [
    // Repositories
    SavedReportsRepository,
    ReportExecutionsRepository,
    ReportSchedulesRepository,
    DashboardsRepository,
    AnalyticsUsageRepository,
    // Services
    TimeAnalyticsService,
    AnalyticsQueryEngineService,
    SavedReportsService,
    ReportExecutionService,
    ReportSchedulingService,
    ReportExportService,
    DashboardsService,
    AnalyticsReportsService,
  ],
})
export class AnalyticsModule {}
