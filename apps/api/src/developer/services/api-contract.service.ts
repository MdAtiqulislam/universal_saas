import { Injectable, NotFoundException } from '@nestjs/common';

export interface ApiEndpointParam {
  name: string;
  in: 'query' | 'path' | 'header';
  required: boolean;
  type: string;
  description: string;
  example?: unknown;
}

export interface ApiEndpointDefinition {
  id: string;
  category: string;
  resource: string;
  operation: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  version: string;
  description: string;
  requiredScopes: string[];
  requiresAuth: boolean;
  parameters: ApiEndpointParam[];
  requestBodySchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  exampleRequest?: Record<string, unknown>;
  exampleResponse?: Record<string, unknown>;
  errorCodes: string[];
  deprecated: boolean;
  deprecatedSince?: string;
  sunsetDate?: string;
}

export interface ApiVersionInfo {
  version: string;
  status: 'stable' | 'beta' | 'deprecated';
  releaseDate: string;
  deprecated: boolean;
  sunsetDate?: string;
  description: string;
}

@Injectable()
export class ApiContractService {
  private readonly endpoints: ApiEndpointDefinition[] = [
    // CRM: Customers
    {
      id: 'crm-customers-list',
      category: 'CRM',
      resource: 'Customers',
      operation: 'listCustomers',
      method: 'GET',
      path: '/api/v1/crm/customers',
      version: 'v1',
      description:
        'Retrieve a paginated list of customers belonging to the current organization',
      requiredScopes: ['customers.view', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'page',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Page number (default 1)',
          example: 1,
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Items per page (max 100)',
          example: 20,
        },
        {
          name: 'search',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Search term for name or email',
          example: 'Acme',
        },
      ],
      responseSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string', example: 'Acme Corporation' },
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'billing@acme.com',
                },
                status: { type: 'string', example: 'ACTIVE' },
              },
            },
          },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 45 },
            },
          },
        },
      },
      exampleResponse: {
        success: true,
        data: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Acme Corporation',
            email: 'billing@acme.com',
            status: 'ACTIVE',
          },
        ],
        meta: { page: 1, limit: 20, total: 1 },
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_API_KEY'],
      deprecated: false,
    },
    {
      id: 'crm-customers-create',
      category: 'CRM',
      resource: 'Customers',
      operation: 'createCustomer',
      method: 'POST',
      path: '/api/v1/crm/customers',
      version: 'v1',
      description: 'Register a new customer for the current organization',
      requiredScopes: ['customers.create', 'api.write'],
      requiresAuth: true,
      parameters: [
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          type: 'string',
          description: 'Unique UUID for idempotent mutation replay',
          example: 'c1b44b20-1a7f-48d6-bd03-49ef87b3252a',
        },
      ],
      requestBodySchema: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            example: 'Apex Logistics Inc',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'ops@apexlogistics.com',
          },
          phone: { type: 'string', example: '+1-555-0199' },
        },
      },
      exampleRequest: {
        name: 'Apex Logistics Inc',
        email: 'ops@apexlogistics.com',
        phone: '+1-555-0199',
      },
      exampleResponse: {
        success: true,
        data: {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Apex Logistics Inc',
          email: 'ops@apexlogistics.com',
          status: 'ACTIVE',
        },
        message: 'Customer created successfully',
      },
      errorCodes: ['VALIDATION_ERROR', 'CONFLICT', 'INSUFFICIENT_API_SCOPE'],
      deprecated: false,
    },

    // Inventory
    {
      id: 'inventory-items-list',
      category: 'Inventory',
      resource: 'Items',
      operation: 'listInventoryItems',
      method: 'GET',
      path: '/api/v1/inventory/items',
      version: 'v1',
      description: 'Query master catalog inventory items and SKUs',
      requiredScopes: ['inventory.view', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'page',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Page number',
          example: 1,
        },
        {
          name: 'category',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Item category filter',
          example: 'RAW_MATERIAL',
        },
      ],
      exampleResponse: {
        success: true,
        data: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            sku: 'RM-JUTE-001',
            name: 'Raw Jute Grade A',
            unit: 'KG',
          },
        ],
        meta: { page: 1, limit: 20, total: 1 },
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },

    // Sales Orders
    {
      id: 'sales-orders-list',
      category: 'Sales',
      resource: 'Orders',
      operation: 'listSalesOrders',
      method: 'GET',
      path: '/api/v1/sales/orders',
      version: 'v1',
      description: 'List tenant sales orders with fulfilment status',
      requiredScopes: ['sales.orders.view', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'status',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Order status (DRAFT, CONFIRMED, SHIPPED)',
          example: 'CONFIRMED',
        },
      ],
      exampleResponse: {
        success: true,
        data: [
          {
            id: '44444444-4444-4444-4444-444444444444',
            orderNumber: 'SO-2026-0001',
            totalAmount: '12500.00',
            status: 'CONFIRMED',
          },
        ],
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },

    // Integrations: Webhooks
    {
      id: 'integrations-webhooks-list',
      category: 'Integrations',
      resource: 'Webhooks',
      operation: 'listWebhooks',
      method: 'GET',
      path: '/api/v1/integrations/webhooks',
      version: 'v1',
      description: 'List outbound webhook subscriptions',
      requiredScopes: ['integrations.webhooks.view', 'api.read'],
      requiresAuth: true,
      parameters: [],
      exampleResponse: {
        success: true,
        data: [
          {
            id: '55555555-5555-5555-5555-555555555555',
            name: 'ERP Sync',
            endpoint: 'https://api.partner.com/events',
            status: 'ACTIVE',
          },
        ],
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },

    // Workflows: Executions
    {
      id: 'workflows-definitions-list',
      category: 'Workflows',
      resource: 'Definitions',
      operation: 'listWorkflowDefinitions',
      method: 'GET',
      path: '/api/v1/workflows',
      version: 'v1',
      description:
        'List tenant workflow automation definitions and active versions',
      requiredScopes: ['workflows.definitions.view', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'category',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Workflow category filter',
          example: 'SALES',
        },
      ],
      exampleResponse: {
        success: true,
        data: [
          {
            id: '66666666-6666-6666-6666-666666666666',
            key: 'order-approval-flow',
            name: 'High-Value Order Approval',
            status: 'ACTIVE',
          },
        ],
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },
    {
      id: 'workflows-execute',
      category: 'Workflows',
      resource: 'Executions',
      operation: 'executeWorkflow',
      method: 'POST',
      path: '/api/v1/workflows/:id/execute',
      version: 'v1',
      description: 'Trigger asynchronous execution of an active workflow',
      requiredScopes: ['workflows.executions.manage', 'api.write'],
      requiresAuth: true,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Workflow Definition UUID',
          example: '66666666-6666-6666-6666-666666666666',
        },
      ],
      requestBodySchema: {
        type: 'object',
        properties: {
          inputContext: {
            type: 'object',
            description: 'Arbitrary execution context JSON',
            example: { orderId: 'SO-101', amount: 5000 },
          },
        },
      },
      exampleRequest: {
        inputContext: { orderId: 'SO-101', amount: 5000 },
      },
      exampleResponse: {
        success: true,
        data: {
          executionId: '77777777-7777-7777-7777-777777777777',
          status: 'RUNNING',
          startedAt: '2026-09-04T10:00:00Z',
        },
      },
      errorCodes: ['NOT_FOUND', 'CONFLICT', 'VALIDATION_ERROR'],
      deprecated: false,
    },
    // Notifications: List
    {
      id: 'notifications-list',
      category: 'Notifications',
      resource: 'Notifications',
      operation: 'listNotifications',
      method: 'GET',
      path: '/api/v1/notifications',
      version: 'v1',
      description:
        'Retrieve paginated notification history for the authenticated tenant',
      requiredScopes: ['notifications.view', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'page',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Page number',
          example: 1,
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Page size limit',
          example: 50,
        },
      ],
      exampleResponse: {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 50 },
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },
    // Notifications: Send
    {
      id: 'notifications-send',
      category: 'Notifications',
      resource: 'Notifications',
      operation: 'sendNotification',
      method: 'POST',
      path: '/api/v1/notifications',
      version: 'v1',
      description:
        'Dispatch an omnichannel notification across specified channels (IN_APP, EMAIL, PUSH, SMS)',
      requiredScopes: ['notifications.manage', 'api.write'],
      requiresAuth: true,
      parameters: [],
      requestBodySchema: {
        type: 'object',
        required: ['eventType'],
        properties: {
          eventType: { type: 'string', example: 'order.shipped' },
          templateKey: { type: 'string', example: 'order_shipped_v1' },
          subject: { type: 'string', example: 'Your order has shipped' },
          body: { type: 'string', example: 'Order #101 is on its way.' },
          channels: {
            type: 'array',
            items: { type: 'string' },
            example: ['IN_APP', 'EMAIL'],
          },
          recipientUserIds: {
            type: 'array',
            items: { type: 'string' },
            example: ['11111111-1111-1111-1111-111111111111'],
          },
          payload: {
            type: 'object',
            example: { orderId: '101', carrier: 'FedEx' },
          },
        },
      },
      exampleRequest: {
        eventType: 'order.shipped',
        templateKey: 'order_shipped_v1',
        channels: ['IN_APP', 'EMAIL'],
        recipientUserIds: ['11111111-1111-1111-1111-111111111111'],
        payload: { orderId: '101', carrier: 'FedEx' },
      },
      exampleResponse: {
        notificationId: '22222222-2222-2222-2222-222222222222',
        status: 'DELIVERED',
        recipientCount: 1,
        deliveriesCount: 2,
      },
      errorCodes: ['VALIDATION_ERROR', 'FORBIDDEN', 'NOT_FOUND'],
      deprecated: false,
    },
    // Notifications: Mark Read
    {
      id: 'notifications-mark-read',
      category: 'Notifications',
      resource: 'Notifications',
      operation: 'markNotificationRead',
      method: 'PATCH',
      path: '/api/v1/notifications/:id/read',
      version: 'v1',
      description: 'Mark a notification recipient status as read',
      requiredScopes: ['notifications.manage', 'api.write'],
      requiresAuth: true,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Notification UUID',
          example: '22222222-2222-2222-2222-222222222222',
        },
      ],
      exampleResponse: {
        success: true,
        message: 'Notification marked as read',
      },
      errorCodes: ['NOT_FOUND', 'FORBIDDEN'],
      deprecated: false,
    },
    // Notifications: Get Preferences
    {
      id: 'notification-preferences-get',
      category: 'Notifications',
      resource: 'Preferences',
      operation: 'getNotificationPreferences',
      method: 'GET',
      path: '/api/v1/notifications/preferences',
      version: 'v1',
      description: 'Get user notification preferences across channels',
      requiredScopes: ['notifications.preferences.view', 'api.read'],
      requiresAuth: true,
      parameters: [],
      exampleResponse: {
        userId: '11111111-1111-1111-1111-111111111111',
        inAppEnabled: true,
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        quietHoursEnabled: false,
      },
      errorCodes: ['UNAUTHORIZED'],
      deprecated: false,
    },
    // Notifications: Update Preferences
    {
      id: 'notification-preferences-update',
      category: 'Notifications',
      resource: 'Preferences',
      operation: 'updateNotificationPreferences',
      method: 'PATCH',
      path: '/api/v1/notifications/preferences',
      version: 'v1',
      description:
        'Update user notification channel preferences and quiet hours',
      requiredScopes: ['notifications.preferences.manage', 'api.write'],
      requiresAuth: true,
      parameters: [],
      requestBodySchema: {
        type: 'object',
        properties: {
          inAppEnabled: { type: 'boolean' },
          emailEnabled: { type: 'boolean' },
          pushEnabled: { type: 'boolean' },
          smsEnabled: { type: 'boolean' },
          quietHoursEnabled: { type: 'boolean' },
          quietHoursStartUtc: { type: 'string', example: '22:00' },
          quietHoursEndUtc: { type: 'string', example: '08:00' },
        },
      },
      exampleResponse: {
        success: true,
        updated: true,
      },
      errorCodes: ['VALIDATION_ERROR', 'UNAUTHORIZED'],
      deprecated: false,
    },
    // Search: Unified Global Search
    {
      id: 'search-global',
      category: 'Search',
      resource: 'UnifiedSearch',
      operation: 'executeSearch',
      method: 'GET',
      path: '/api/v1/search',
      version: 'v1',
      description:
        'Execute unified discovery search across authorized domain scopes',
      requiredScopes: ['search.read', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Search term',
        },
        {
          name: 'scope',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Domain search scope',
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          type: 'number',
          description: 'Page number',
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          type: 'number',
          description: 'Items per page',
        },
      ],
      exampleResponse: {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20 },
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },
    // Search: Autocomplete Suggestions
    {
      id: 'search-suggestions',
      category: 'Search',
      resource: 'UnifiedSearch',
      operation: 'getSuggestions',
      method: 'GET',
      path: '/api/v1/search/suggestions',
      version: 'v1',
      description: 'Retrieve real-time search suggestions and auto-completions',
      requiredScopes: ['search.read', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          type: 'string',
          description: 'Query prefix',
        },
        {
          name: 'scope',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Domain search scope',
        },
      ],
      exampleResponse: {
        success: true,
        data: [],
      },
      errorCodes: ['UNAUTHORIZED'],
      deprecated: false,
    },
    // Saved Views: List
    {
      id: 'saved-views-list',
      category: 'Search',
      resource: 'SavedViews',
      operation: 'listSavedViews',
      method: 'GET',
      path: '/api/v1/saved-views',
      version: 'v1',
      description: 'List personal, shared, and tenant saved views',
      requiredScopes: ['search.views.read', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'resourceType',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter saved views by resource type',
        },
        {
          name: 'scope',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter saved views by search scope',
        },
      ],
      exampleResponse: {
        success: true,
        data: [],
      },
      errorCodes: ['UNAUTHORIZED'],
      deprecated: false,
    },
    // Saved Views: Create
    {
      id: 'saved-views-create',
      category: 'Search',
      resource: 'SavedViews',
      operation: 'createSavedView',
      method: 'POST',
      path: '/api/v1/saved-views',
      version: 'v1',
      description: 'Create a new personal or tenant-level saved view',
      requiredScopes: ['search.views.manage', 'api.write'],
      requiresAuth: true,
      parameters: [],
      requestBodySchema: {
        type: 'object',
        required: ['name', 'resourceType'],
        properties: {
          name: { type: 'string' },
          resourceType: { type: 'string' },
          visibility: {
            type: 'string',
            enum: ['PERSONAL', 'SHARED', 'TENANT'],
          },
          filters: { type: 'object' },
        },
      },
      exampleResponse: {
        success: true,
        data: { id: 'view-1', name: 'Active Customers' },
      },
      errorCodes: ['VALIDATION_ERROR', 'UNAUTHORIZED'],
      deprecated: false,
    },
    // Saved Views: Get
    {
      id: 'saved-views-get',
      category: 'Search',
      resource: 'SavedViews',
      operation: 'getSavedView',
      method: 'GET',
      path: '/api/v1/saved-views/:id',
      version: 'v1',
      description: 'Retrieve a saved view definition by ID',
      requiredScopes: ['search.views.read', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Saved View ID',
        },
      ],
      exampleResponse: {
        success: true,
        data: { id: 'view-1', name: 'Active Customers' },
      },
      errorCodes: ['NOT_FOUND', 'UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },
    // M45 — Analytics, Reporting & Business Intelligence Foundation
    {
      id: 'analytics-definitions-list',
      category: 'Analytics',
      resource: 'AnalyticsDefinitions',
      operation: 'listDefinitions',
      method: 'GET',
      path: '/api/v1/analytics/definitions',
      version: 'v1',
      description:
        'List available analytics domain datasets and metric catalogs',
      requiredScopes: ['analytics.definitions.view', 'api.read'],
      requiresAuth: true,
      parameters: [],
      exampleResponse: {
        success: true,
        data: [
          { definitionKey: 'sales.revenue', name: 'Sales Revenue Analytics' },
        ],
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },
    {
      id: 'analytics-query',
      category: 'Analytics',
      resource: 'AnalyticsQueries',
      operation: 'executeQuery',
      method: 'POST',
      path: '/api/v1/analytics/query',
      version: 'v1',
      description:
        'Execute an analytics query with declarative dimensions, measures, and AST filters',
      requiredScopes: ['analytics.query.execute', 'api.read'],
      requiresAuth: true,
      parameters: [],
      requestBodySchema: {
        type: 'object',
        required: ['definitionKey'],
        properties: {
          definitionKey: { type: 'string' },
          dimensions: { type: 'array' },
          measures: { type: 'array' },
          filterAst: { type: 'object' },
        },
      },
      exampleResponse: {
        success: true,
        data: [{ customerId: 'cust-1', sum_totalRevenue: 50000 }],
        meta: { totalRows: 1, executionTimeMs: 12 },
      },
      errorCodes: ['BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'],
      deprecated: false,
    },
    {
      id: 'analytics-reports-list',
      category: 'Analytics',
      resource: 'SavedReports',
      operation: 'listReports',
      method: 'GET',
      path: '/api/v1/analytics/reports',
      version: 'v1',
      description: 'List accessible saved analytics reports',
      requiredScopes: ['analytics.reports.view', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'definitionKey',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter by dataset definition key',
        },
      ],
      exampleResponse: {
        success: true,
        data: { reports: [], total: 0 },
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },
    {
      id: 'analytics-reports-create',
      category: 'Analytics',
      resource: 'SavedReports',
      operation: 'createReport',
      method: 'POST',
      path: '/api/v1/analytics/reports',
      version: 'v1',
      description:
        'Create a new saved report with reusable query configuration',
      requiredScopes: ['analytics.reports.create', 'api.write'],
      requiresAuth: true,
      parameters: [],
      requestBodySchema: {
        type: 'object',
        required: ['definitionKey', 'name'],
        properties: {
          definitionKey: { type: 'string' },
          name: { type: 'string' },
          dimensions: { type: 'array' },
          measures: { type: 'array' },
        },
      },
      exampleResponse: {
        success: true,
        data: { id: 'rep-1', name: 'Monthly Revenue' },
      },
      errorCodes: ['BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },
    {
      id: 'analytics-reports-get',
      category: 'Analytics',
      resource: 'SavedReports',
      operation: 'getReport',
      method: 'GET',
      path: '/api/v1/analytics/reports/:id',
      version: 'v1',
      description: 'Retrieve a saved report definition by ID',
      requiredScopes: ['analytics.reports.view', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Report ID',
        },
      ],
      exampleResponse: {
        success: true,
        data: { id: 'rep-1', name: 'Monthly Revenue' },
      },
      errorCodes: ['NOT_FOUND', 'UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },
    {
      id: 'analytics-dashboards-list',
      category: 'Analytics',
      resource: 'Dashboards',
      operation: 'listDashboards',
      method: 'GET',
      path: '/api/v1/analytics/dashboards',
      version: 'v1',
      description: 'List accessible business intelligence dashboards',
      requiredScopes: ['analytics.dashboards.view', 'api.read'],
      requiresAuth: true,
      parameters: [],
      exampleResponse: {
        success: true,
        data: { dashboards: [], total: 0 },
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN'],
      deprecated: false,
    },
    // M46 — Data Export, Import & Bulk Operations Platform
    {
      id: 'data-operations-imports',
      category: 'Data Operations',
      resource: 'Imports',
      operation: 'commitImport',
      method: 'POST',
      path: '/api/v1/data-operations/imports',
      version: 'v1',
      description: 'Commit a batch data import to persistent storage',
      requiredScopes: ['data_operations.import.execute', 'api.write'],
      requiresAuth: true,
      parameters: [],
      exampleRequest: {
        operationKey: 'crm.customer.import',
        fileContent: 'name,email\nAcme Corp,contact@acme.com',
        mode: 'UPSERT',
      },
      exampleResponse: {
        success: true,
        data: {
          jobId: 'job-123',
          status: 'COMPLETED',
          totalRows: 1,
          successfulRows: 1,
        },
      },
      errorCodes: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'BAD_REQUEST',
        'QUOTA_EXCEEDED',
      ],
      deprecated: false,
    },
    {
      id: 'data-operations-exports',
      category: 'Data Operations',
      resource: 'Exports',
      operation: 'exportData',
      method: 'POST',
      path: '/api/v1/data-operations/exports',
      version: 'v1',
      description: 'Trigger a tenant data export in CSV or JSON format',
      requiredScopes: ['data_operations.export.execute', 'api.read'],
      requiresAuth: true,
      parameters: [],
      exampleRequest: {
        operationKey: 'crm.customer.export',
        format: 'CSV',
      },
      exampleResponse: {
        success: true,
        data: { jobId: 'job-456', format: 'CSV', rowCount: 10 },
      },
      errorCodes: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'BAD_REQUEST',
        'QUOTA_EXCEEDED',
      ],
      deprecated: false,
    },
    {
      id: 'data-operations-jobs-get',
      category: 'Data Operations',
      resource: 'Jobs',
      operation: 'getJob',
      method: 'GET',
      path: '/api/v1/data-operations/jobs/:id',
      version: 'v1',
      description:
        'Retrieve status, metrics, and progress for a data operation job',
      requiredScopes: ['data_operations.jobs.view', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Data operation job UUID',
        },
      ],
      exampleResponse: {
        success: true,
        data: {
          id: 'job-123',
          status: 'COMPLETED',
          totalRows: 10,
          processedRows: 10,
        },
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'],
      deprecated: false,
    },
    {
      id: 'data-operations-jobs-result',
      category: 'Data Operations',
      resource: 'Jobs',
      operation: 'getJobResult',
      method: 'GET',
      path: '/api/v1/data-operations/jobs/:id/result',
      version: 'v1',
      description: 'Download the completed export result file',
      requiredScopes: ['data_operations.export.execute', 'api.read'],
      requiresAuth: true,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Data operation job UUID',
        },
      ],
      exampleResponse: {
        success: true,
        data: {
          fileContent: '...',
          fileName: 'customer_123.csv',
          format: 'CSV',
        },
      },
      errorCodes: ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_REQUEST'],
      deprecated: false,
    },
  ];

  private readonly versions: ApiVersionInfo[] = [
    {
      version: 'v1',
      status: 'stable',
      releaseDate: '2026-01-15',
      deprecated: false,
      description:
        'Current production public API for Universal Business Operations SaaS.',
    },
  ];

  listEndpoints(category?: string): ApiEndpointDefinition[] {
    if (!category) return this.endpoints;
    return this.endpoints.filter(
      (e) => e.category.toLowerCase() === category.toLowerCase(),
    );
  }

  getEndpointById(id: string): ApiEndpointDefinition {
    const endpoint = this.endpoints.find((e) => e.id === id);
    if (!endpoint) {
      throw new NotFoundException(`API endpoint definition '${id}' not found`);
    }
    return endpoint;
  }

  findEndpointByMethodAndPath(
    method: string,
    path: string,
  ): ApiEndpointDefinition | null {
    const normPath = path.split('?')[0].replace(/\/$/, '');
    const found = this.endpoints.find((e) => {
      if (e.method !== method.toUpperCase()) return false;
      // Match pattern with :param or direct string
      const endpointRegex = new RegExp(
        '^' + e.path.replace(/:[a-zA-Z0-9_]+/g, '[a-zA-Z0-9_-]+') + '$',
      );
      return endpointRegex.test(normPath);
    });
    return found || null;
  }

  getApiVersions(): ApiVersionInfo[] {
    return this.versions;
  }

  getErrorTaxonomy(): Record<
    string,
    { httpStatus: number; description: string }
  > {
    return {
      AUTHENTICATION_REQUIRED: {
        httpStatus: 401,
        description:
          'Missing or malformed Authorization header or API key token.',
      },
      INVALID_API_KEY: {
        httpStatus: 401,
        description: 'Supplied API key is invalid or unrecognized.',
      },
      API_KEY_EXPIRED: {
        httpStatus: 401,
        description:
          'The API key has passed its configured expiration timestamp.',
      },
      API_KEY_REVOKED: {
        httpStatus: 401,
        description:
          'The API key has been explicitly revoked by an administrator.',
      },
      INSUFFICIENT_API_SCOPE: {
        httpStatus: 403,
        description:
          'API key possesses insufficient permission scopes to access this resource.',
      },
      CROSS_TENANT_ACCESS_FORBIDDEN: {
        httpStatus: 403,
        description:
          'The API key is bound to a different tenant organization and cannot access foreign resources.',
      },
      RATE_LIMIT_EXCEEDED: {
        httpStatus: 429,
        description:
          'The tenant or API key rate limit ceiling has been reached for the active window.',
      },
      RESOURCE_NOT_FOUND: {
        httpStatus: 404,
        description:
          'The requested resource identifier does not exist within the tenant scope.',
      },
      VALIDATION_ERROR: {
        httpStatus: 400,
        description:
          'Request payload failed schema validation or contained prohibited parameters.',
      },
      IDEMPOTENCY_CONFLICT: {
        httpStatus: 409,
        description:
          'A mutation with this Idempotency-Key is currently in-flight or encountered a concurrent race.',
      },
      API_VERSION_UNSUPPORTED: {
        httpStatus: 400,
        description:
          'The requested API version prefix is not recognized by the platform.',
      },
      API_VERSION_DEPRECATED: {
        httpStatus: 410,
        description: 'The targeted API version has been permanently retired.',
      },
    };
  }

  getOpenApiSpec(): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const ep of this.endpoints) {
      if (!paths[ep.path]) {
        paths[ep.path] = {};
      }

      const methodKey = ep.method.toLowerCase();
      paths[ep.path][methodKey] = {
        tags: [ep.category],
        summary: ep.operation,
        description: ep.description,
        operationId: ep.id,
        deprecated: ep.deprecated,
        security: ep.requiresAuth
          ? [{ BearerAuth: [] }, { ApiKeyAuth: [] }]
          : [],
        parameters: ep.parameters.map((p) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          description: p.description,
          schema: { type: p.type },
          example: p.example,
        })),
        ...(ep.requestBodySchema
          ? {
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: ep.requestBodySchema,
                    example: ep.exampleRequest,
                  },
                },
              },
            }
          : {}),
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: ep.responseSchema || { type: 'object' },
                example: ep.exampleResponse,
              },
            },
          },
          '401': { description: 'Unauthorized — Invalid or missing API key' },
          '403': {
            description:
              'Forbidden — Insufficient scope or cross-tenant boundary breach',
          },
          '429': { description: 'Rate limit exceeded' },
        },
      };
    }

    return {
      openapi: '3.0.3',
      info: {
        title: 'Universal Business Operations SaaS Public API',
        version: '1.0.0',
        description:
          'Production-grade REST API platform for tenant-isolated enterprise integrations, automation, and SDK generation.',
        contact: {
          name: 'Developer Platform Team',
          url: 'https://docs.universalsaas.internal/developer',
        },
      },
      servers: [
        {
          url: '/api/v1',
          description: 'Production v1 API gateway',
        },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description: "Provide API key formatted as 'Bearer <api-key>'",
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      paths,
    };
  }
}
