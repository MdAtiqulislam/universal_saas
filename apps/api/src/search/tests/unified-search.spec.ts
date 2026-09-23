import { ForbiddenException } from '@nestjs/common';
import { UnifiedSearchService } from '../services/unified-search.service';
import { SearchScope } from '@prisma/client';

describe('UnifiedSearchService', () => {
  let service: UnifiedSearchService;
  let customerProvider: any;
  let salesProvider: any;
  let inventoryProvider: any;
  let warehouseProvider: any;
  let qualityProvider: any;
  let returnsProvider: any;
  let serviceProvider: any;
  let financeProvider: any;
  let workflowProvider: any;
  let notificationProvider: any;
  let userProvider: any;
  let rankingService: any;
  let filterEngine: any;
  let historyService: any;
  let analyticsService: any;
  let cacheService: any;

  beforeEach(() => {
    customerProvider = {
      scope: SearchScope.CRM,
      resourceType: 'Customer',
      requiredPermission: 'crm.customers.read',
      search: jest.fn().mockResolvedValue([
        {
          id: 'cust-1',
          scope: SearchScope.CRM,
          resourceType: 'Customer',
          title: 'Customer Alpha',
          createdAt: new Date(),
        },
      ]),
      getSuggestions: jest.fn(),
    };

    salesProvider = {
      scope: SearchScope.SALES,
      resourceType: 'SalesOrder',
      requiredPermission: 'sales.orders.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    inventoryProvider = {
      scope: SearchScope.INVENTORY,
      resourceType: 'Item',
      requiredPermission: 'inventory.items.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    warehouseProvider = {
      scope: SearchScope.WAREHOUSE,
      resourceType: 'Location',
      requiredPermission: 'warehouse.locations.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    qualityProvider = {
      scope: SearchScope.QUALITY,
      resourceType: 'QualityInspectionLot',
      requiredPermission: 'quality.inspections.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    returnsProvider = {
      scope: SearchScope.RETURNS,
      resourceType: 'ReturnRequest',
      requiredPermission: 'returns.requests.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    serviceProvider = {
      scope: SearchScope.SERVICE,
      resourceType: 'ServiceTicket',
      requiredPermission: 'service.tickets.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    financeProvider = {
      scope: SearchScope.FINANCE,
      resourceType: 'CustomerInvoice',
      requiredPermission: 'finance.invoices.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    workflowProvider = {
      scope: SearchScope.WORKFLOW,
      resourceType: 'WorkflowDefinition',
      requiredPermission: 'workflows.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    notificationProvider = {
      scope: SearchScope.NOTIFICATIONS,
      resourceType: 'Notification',
      requiredPermission: 'notifications.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    userProvider = {
      scope: SearchScope.ADMIN,
      resourceType: 'User',
      requiredPermission: 'users.read',
      search: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn(),
    };

    rankingService = {
      rankAndSort: jest.fn((records) => records),
      computeRelevanceScore: jest.fn(() => 100),
    };

    filterEngine = {
      validateAst: jest.fn(),
      evaluate: jest.fn(() => true),
    };

    historyService = {
      recordSearch: jest.fn().mockResolvedValue({}),
    };

    analyticsService = {
      recordSearchEvent: jest.fn().mockResolvedValue(undefined),
    };

    cacheService = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn().mockReturnValue(undefined),
      tenantKey: jest.fn(
        (orgId, namespace, suffix) => `tenants:${orgId}:${namespace}:${suffix}`,
      ),
    };

    service = new UnifiedSearchService(
      customerProvider,
      salesProvider,
      inventoryProvider,
      warehouseProvider,
      qualityProvider,
      returnsProvider,
      serviceProvider,
      financeProvider,
      workflowProvider,
      notificationProvider,
      userProvider,
      rankingService,
      filterEngine,
      historyService,
      analyticsService,
      cacheService,
    );
  });

  describe('resolveAuthorizedProviders (INV-479)', () => {
    it('returns only providers that user has permissions for', () => {
      const authorized = service.resolveAuthorizedProviders({
        scope: SearchScope.GLOBAL,
        userPermissions: ['crm.customers.read'],
      });

      expect(authorized.length).toBe(1);
      expect(authorized[0].resourceType).toBe('Customer');
    });

    it('returns empty list if user has no relevant permissions', () => {
      const authorized = service.resolveAuthorizedProviders({
        scope: SearchScope.GLOBAL,
        userPermissions: ['unrelated.permission'],
      });

      expect(authorized.length).toBe(0);
    });

    it('returns all providers when user has search.admin permission', () => {
      const authorized = service.resolveAuthorizedProviders({
        scope: SearchScope.GLOBAL,
        userPermissions: ['search.admin'],
      });

      expect(authorized.length).toBe(11);
    });
  });

  describe('search (INV-478, INV-484, INV-498)', () => {
    it('throws ForbiddenException if organizationId is missing (INV-478)', async () => {
      await expect(
        service.search({
          organizationId: '',
          userPermissions: ['crm.customers.read'],
          queryDto: { q: 'test' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces maximum page limit server-side (INV-484)', async () => {
      const result = await service.search({
        organizationId: 'org-1',
        userPermissions: ['crm.customers.read'],
        queryDto: { q: 'test', limit: 500 },
      });

      expect(result.meta.limit).toBeLessThanOrEqual(100);
    });

    it('queries provider with tenant organizationId and caches with tenant key (INV-498)', async () => {
      await service.search({
        organizationId: 'org-1',
        userId: 'user-1',
        userPermissions: ['crm.customers.read'],
        queryDto: { q: 'Alpha', recordHistory: true },
      });

      expect(customerProvider.search).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          query: 'Alpha',
        }),
      );
      expect(cacheService.tenantKey).toHaveBeenCalledWith(
        'org-1',
        'search',
        expect.any(String),
      );
      expect(historyService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
          queryText: 'Alpha',
        }),
      );
    });
  });
});
