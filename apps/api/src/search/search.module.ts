import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuditModule } from '../audit/audit.module';
import { OperationsModule } from '../operations/operations.module';
import { NotificationsModule } from '../notifications/notifications.module';

// DTOs & Providers
import { CustomerSearchProvider } from './providers/customer-search.provider';
import { SalesSearchProvider } from './providers/sales-search.provider';
import { InventorySearchProvider } from './providers/inventory-search.provider';
import { WarehouseSearchProvider } from './providers/warehouse-search.provider';
import { QualitySearchProvider } from './providers/quality-search.provider';
import { ReturnsSearchProvider } from './providers/returns-search.provider';
import { ServiceSearchProvider } from './providers/service-search.provider';
import { FinanceSearchProvider } from './providers/finance-search.provider';
import { WorkflowSearchProvider } from './providers/workflow-search.provider';
import { NotificationSearchProvider } from './providers/notification-search.provider';
import { UserSearchProvider } from './providers/user-search.provider';

// Repositories
import { SearchHistoryRepository } from './repositories/search-history.repository';
import { RecentItemsRepository } from './repositories/recent-items.repository';
import { FavoritesRepository } from './repositories/favorites.repository';
import { SavedViewsRepository } from './repositories/saved-views.repository';
import { SearchAlertsRepository } from './repositories/search-alerts.repository';
import { SearchAnalyticsRepository } from './repositories/search-analytics.repository';

// Services
import { FilterAstEngineService } from './services/filter-ast-engine.service';
import { SearchRankingService } from './services/search-ranking.service';
import { SearchHistoryService } from './services/search-history.service';
import { RecentItemsService } from './services/recent-items.service';
import { FavoritesService } from './services/favorites.service';
import { SavedViewsService } from './services/saved-views.service';
import { SearchAlertsService } from './services/search-alerts.service';
import { SearchAnalyticsService } from './services/search-analytics.service';
import { SearchReportsService } from './services/search-reports.service';
import { UnifiedSearchService } from './services/unified-search.service';

// Controllers
import { UnifiedSearchController } from './controllers/unified-search.controller';
import { SavedViewsController } from './controllers/saved-views.controller';
import { SearchHistoryController } from './controllers/search-history.controller';
import { RecentItemsController } from './controllers/recent-items.controller';
import { FavoritesController } from './controllers/favorites.controller';
import { SearchAlertsController } from './controllers/search-alerts.controller';
import { SearchReportsController } from './controllers/search-reports.controller';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuditModule,
    OperationsModule,
    forwardRef(() => NotificationsModule),
  ],
  providers: [
    // Providers
    CustomerSearchProvider,
    SalesSearchProvider,
    InventorySearchProvider,
    WarehouseSearchProvider,
    QualitySearchProvider,
    ReturnsSearchProvider,
    ServiceSearchProvider,
    FinanceSearchProvider,
    WorkflowSearchProvider,
    NotificationSearchProvider,
    UserSearchProvider,

    // Repositories
    SearchHistoryRepository,
    RecentItemsRepository,
    FavoritesRepository,
    SavedViewsRepository,
    SearchAlertsRepository,
    SearchAnalyticsRepository,

    // Services
    FilterAstEngineService,
    SearchRankingService,
    SearchHistoryService,
    RecentItemsService,
    FavoritesService,
    SavedViewsService,
    SearchAlertsService,
    SearchAnalyticsService,
    SearchReportsService,
    UnifiedSearchService,
  ],
  controllers: [
    UnifiedSearchController,
    SavedViewsController,
    SearchHistoryController,
    RecentItemsController,
    FavoritesController,
    SearchAlertsController,
    SearchReportsController,
  ],
  exports: [
    UnifiedSearchService,
    SavedViewsService,
    SearchAlertsService,
    FilterAstEngineService,
    SearchRankingService,
  ],
})
export class SearchModule {}
