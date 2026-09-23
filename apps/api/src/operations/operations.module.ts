import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';
import { StructuredLoggingService } from './logging/structured-logging.service';
import { CorrelationContextService } from './logging/correlation-context.service';
import { RequestLoggingInterceptor } from './logging/request-logging.interceptor';
import { MetricsService } from './metrics/metrics.service';
import { HealthService } from './health/health.service';
import { HealthController } from './health/health.controller';
import { OperationalErrorsService } from './errors/operational-errors.service';
import { GlobalExceptionFilter } from './errors/global-exception.filter';
import { IncidentService } from './incidents/incident.service';
import { IncidentController } from './incidents/incident.controller';
import { AlertingService } from './alerting/alerting.service';
import { AlertingController } from './alerting/alerting.controller';
import { SloService } from './slo/slo.service';
import { SloController } from './slo/slo.controller';
import { OperationsReportsService } from './reports/operations-reports.service';
import { OperationsController } from './operations.controller';

const services = [
  StructuredLoggingService,
  CorrelationContextService,
  RequestLoggingInterceptor,
  MetricsService,
  HealthService,
  OperationalErrorsService,
  GlobalExceptionFilter,
  IncidentService,
  AlertingService,
  SloService,
  OperationsReportsService,
];

@Global()
@Module({
  imports: [PrismaModule, AuditModule, SecurityModule],
  controllers: [
    HealthController,
    IncidentController,
    AlertingController,
    SloController,
    OperationsController,
  ],
  providers: [...services],
  exports: [...services],
})
export class OperationsModule {}
