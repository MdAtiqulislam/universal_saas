import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';
import { IntegrationsModule } from '../integrations/integrations.module';

// Repositories
import { ApiUsageRepository } from './repositories/api-usage.repository';

// Services
import { ApiContractService } from './services/api-contract.service';
import { ApiUsageService } from './services/api-usage.service';
import { ApiExplorerService } from './services/api-explorer.service';
import { DeveloperDashboardService } from './services/developer-dashboard.service';
import { DeveloperExportService } from './services/developer-export.service';

// Guards & Interceptors
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { ApiScopeGuard } from './guards/api-scope.guard';
import { ApiUsageInterceptor } from './interceptors/api-usage.interceptor';

// Controllers
import { DeveloperDashboardController } from './controllers/developer-dashboard.controller';
import { DeveloperApiController } from './controllers/developer-api.controller';
import { DeveloperUsageController } from './controllers/developer-usage.controller';
import { DeveloperErrorsController } from './controllers/developer-errors.controller';
import { DeveloperDocsController } from './controllers/developer-docs.controller';

@Module({
  imports: [PrismaModule, AuditModule, SecurityModule, IntegrationsModule],
  controllers: [
    DeveloperDashboardController,
    DeveloperApiController,
    DeveloperUsageController,
    DeveloperErrorsController,
    DeveloperDocsController,
  ],
  providers: [
    ApiUsageRepository,
    ApiContractService,
    ApiUsageService,
    ApiExplorerService,
    DeveloperDashboardService,
    DeveloperExportService,
    ApiKeyAuthGuard,
    ApiScopeGuard,
    ApiUsageInterceptor,
  ],
  exports: [
    ApiContractService,
    ApiUsageService,
    ApiExplorerService,
    DeveloperDashboardService,
    DeveloperExportService,
    ApiKeyAuthGuard,
    ApiScopeGuard,
    ApiUsageInterceptor,
  ],
})
export class DeveloperModule {}
