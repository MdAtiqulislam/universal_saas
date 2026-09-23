import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';
import { SecurityAuthHardeningService } from './authentication/security-auth-hardening.service';
import { SecuritySessionsService } from './sessions/security-sessions.service';
import { SecuritySessionsController } from './sessions/security-sessions.controller';
import { SecurityEventsService } from './events/security-events.service';
import { SecurityEventsController } from './events/security-events.controller';
import { SecurityPoliciesService } from './policies/security-policies.service';
import { SecurityPoliciesController } from './policies/security-policies.controller';
import { RateLimitingService } from './rate-limiting/rate-limiting.service';
import { SecurityReportsService } from './reports/security-reports.service';
import { SecurityReportsController } from './reports/security-reports.controller';
import { SecurityDashboardService } from './dashboard/security-dashboard.service';
import { SecurityDashboardController } from './dashboard/security-dashboard.controller';

@Module({
  imports: [PrismaModule, EventsModule, AuditModule],
  controllers: [
    SecurityDashboardController,
    SecuritySessionsController,
    SecurityEventsController,
    SecurityPoliciesController,
    SecurityReportsController,
  ],
  providers: [
    SecurityAuthHardeningService,
    SecuritySessionsService,
    SecurityEventsService,
    SecurityPoliciesService,
    RateLimitingService,
    SecurityReportsService,
    SecurityDashboardService,
  ],
  exports: [
    SecurityAuthHardeningService,
    SecuritySessionsService,
    SecurityEventsService,
    SecurityPoliciesService,
    RateLimitingService,
    SecurityReportsService,
    SecurityDashboardService,
  ],
})
export class SecurityModule {}
