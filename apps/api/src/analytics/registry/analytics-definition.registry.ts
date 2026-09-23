export interface MeasureDefinition {
  name: string;
  label: string;
  aggregations: ('COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX')[];
  isCurrency?: boolean;
  unit?: string;
}

export interface AnalyticsDefinitionRecord {
  definitionKey: string;
  name: string;
  domain: string;
  description: string;
  allowedDimensions: string[];
  allowedMeasures: MeasureDefinition[];
  supportedAggregations: ('COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX')[];
  allowedFilterFields: string[];
  requiredPermissions: string[];
  defaultTimeDimension: string;
  allowedTimeDimensions: string[];
  modelName: string;
}

export const ANALYTICS_DEFINITIONS: Record<string, AnalyticsDefinitionRecord> =
  {
    'sales.revenue': {
      definitionKey: 'sales.revenue',
      name: 'Sales Revenue Analytics',
      domain: 'sales',
      description:
        'Aggregated sales order revenue, discounts, taxes, and margins',
      allowedDimensions: [
        'customerId',
        'currency',
        'status',
        'channel',
        'salesRepId',
      ],
      allowedMeasures: [
        { name: 'orderCount', label: 'Order Count', aggregations: ['COUNT'] },
        {
          name: 'totalRevenue',
          label: 'Total Revenue (cents)',
          aggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
          isCurrency: true,
          unit: 'cents',
        },
        {
          name: 'discountAmount',
          label: 'Discounts (cents)',
          aggregations: ['SUM', 'AVG'],
          isCurrency: true,
          unit: 'cents',
        },
        {
          name: 'taxAmount',
          label: 'Tax Collected (cents)',
          aggregations: ['SUM', 'AVG'],
          isCurrency: true,
          unit: 'cents',
        },
        {
          name: 'subtotalAmount',
          label: 'Subtotal (cents)',
          aggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
          isCurrency: true,
          unit: 'cents',
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
      allowedFilterFields: [
        'customerId',
        'currency',
        'status',
        'channel',
        'salesRepId',
        'createdAt',
        'totalRevenue',
      ],
      requiredPermissions: ['sales.orders.view', 'analytics.query.execute'],
      defaultTimeDimension: 'createdAt',
      allowedTimeDimensions: ['createdAt', 'updatedAt'],
      modelName: 'salesOrder',
    },

    'sales.orders': {
      definitionKey: 'sales.orders',
      name: 'Sales Orders Volume & Pipeline',
      domain: 'sales',
      description:
        'Volume, status transitions, and fulfillment metrics for sales orders',
      allowedDimensions: [
        'status',
        'paymentStatus',
        'fulfillmentStatus',
        'channel',
        'warehouseId',
      ],
      allowedMeasures: [
        { name: 'orderCount', label: 'Total Orders', aggregations: ['COUNT'] },
        {
          name: 'itemCount',
          label: 'Total Items Sold',
          aggregations: ['SUM', 'AVG'],
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG'],
      allowedFilterFields: [
        'status',
        'paymentStatus',
        'fulfillmentStatus',
        'channel',
        'warehouseId',
        'createdAt',
      ],
      requiredPermissions: ['sales.orders.view', 'analytics.query.execute'],
      defaultTimeDimension: 'createdAt',
      allowedTimeDimensions: ['createdAt', 'updatedAt'],
      modelName: 'salesOrder',
    },

    'inventory.stock': {
      definitionKey: 'inventory.stock',
      name: 'Inventory Stock Levels & Valuation',
      domain: 'inventory',
      description:
        'Current on-hand stock quantities, reserved inventory, and inventory valuation',
      allowedDimensions: [
        'warehouseId',
        'locationId',
        'category',
        'status',
        'sku',
      ],
      allowedMeasures: [
        { name: 'itemCount', label: 'Item Count', aggregations: ['COUNT'] },
        {
          name: 'quantityOnHand',
          label: 'Quantity On Hand',
          aggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
        },
        {
          name: 'quantityReserved',
          label: 'Quantity Reserved',
          aggregations: ['SUM', 'AVG'],
        },
        {
          name: 'stockValuation',
          label: 'Stock Valuation (cents)',
          aggregations: ['SUM', 'AVG'],
          isCurrency: true,
          unit: 'cents',
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
      allowedFilterFields: [
        'warehouseId',
        'locationId',
        'category',
        'status',
        'sku',
        'updatedAt',
        'quantityOnHand',
      ],
      requiredPermissions: ['inventory.stock.view', 'analytics.query.execute'],
      defaultTimeDimension: 'updatedAt',
      allowedTimeDimensions: ['updatedAt', 'createdAt'],
      modelName: 'inventoryItem',
    },

    'inventory.turnover': {
      definitionKey: 'inventory.turnover',
      name: 'Inventory Turnover & Movement',
      domain: 'inventory',
      description:
        'Stock ledger movements, inward/outward adjustments, and turnover velocity',
      allowedDimensions: ['movementType', 'reasonCode', 'warehouseId', 'sku'],
      allowedMeasures: [
        {
          name: 'movementCount',
          label: 'Movements Count',
          aggregations: ['COUNT'],
        },
        {
          name: 'quantity',
          label: 'Movement Quantity',
          aggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
        },
        {
          name: 'movementValue',
          label: 'Movement Value (cents)',
          aggregations: ['SUM', 'AVG'],
          isCurrency: true,
          unit: 'cents',
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
      allowedFilterFields: [
        'movementType',
        'reasonCode',
        'warehouseId',
        'sku',
        'occurredAt',
      ],
      requiredPermissions: ['inventory.stock.view', 'analytics.query.execute'],
      defaultTimeDimension: 'occurredAt',
      allowedTimeDimensions: ['occurredAt'],
      modelName: 'inventoryMovement',
    },

    'warehouse.throughput': {
      definitionKey: 'warehouse.throughput',
      name: 'Warehouse Operations Throughput',
      domain: 'warehouse',
      description:
        'Picking, packing, put-away, and dispatch volume and efficiency',
      allowedDimensions: [
        'warehouseId',
        'zoneId',
        'taskType',
        'status',
        'operatorUserId',
      ],
      allowedMeasures: [
        { name: 'taskCount', label: 'Task Count', aggregations: ['COUNT'] },
        {
          name: 'durationMinutes',
          label: 'Task Duration (mins)',
          aggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
        },
        {
          name: 'itemsHandled',
          label: 'Items Handled',
          aggregations: ['SUM', 'AVG'],
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
      allowedFilterFields: [
        'warehouseId',
        'zoneId',
        'taskType',
        'status',
        'operatorUserId',
        'completedAt',
      ],
      requiredPermissions: [
        'warehouse.operations.view',
        'analytics.query.execute',
      ],
      defaultTimeDimension: 'completedAt',
      allowedTimeDimensions: ['completedAt', 'createdAt'],
      modelName: 'warehouseTask',
    },

    'quality.defects': {
      definitionKey: 'quality.defects',
      name: 'Quality Inspections & Defect Rates',
      domain: 'quality',
      description:
        'Inspection pass/fail rates, defect severity categorization, and compliance stats',
      allowedDimensions: [
        'severity',
        'inspectionType',
        'status',
        'vendorId',
        'disposition',
      ],
      allowedMeasures: [
        {
          name: 'inspectionCount',
          label: 'Total Inspections',
          aggregations: ['COUNT'],
        },
        {
          name: 'defectCount',
          label: 'Defect Incidents',
          aggregations: ['SUM', 'COUNT'],
        },
        {
          name: 'defectRate',
          label: 'Defect Rate (%)',
          aggregations: ['AVG', 'MAX'],
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG', 'MAX'],
      allowedFilterFields: [
        'severity',
        'inspectionType',
        'status',
        'vendorId',
        'disposition',
        'inspectedAt',
      ],
      requiredPermissions: [
        'quality.inspections.view',
        'analytics.query.execute',
      ],
      defaultTimeDimension: 'inspectedAt',
      allowedTimeDimensions: ['inspectedAt', 'createdAt'],
      modelName: 'qualityInspection',
    },

    'returns.rate': {
      definitionKey: 'returns.rate',
      name: 'Returns & RMA Operational Rates',
      domain: 'returns',
      description:
        'Return merchandise authorization rates, return reasons, and refund sums',
      allowedDimensions: [
        'reason',
        'status',
        'resolution',
        'customerId',
        'warehouseId',
      ],
      allowedMeasures: [
        {
          name: 'returnCount',
          label: 'Total Returns',
          aggregations: ['COUNT'],
        },
        {
          name: 'refundAmount',
          label: 'Refund Amount (cents)',
          aggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
          isCurrency: true,
          unit: 'cents',
        },
        {
          name: 'restockCount',
          label: 'Restocked Items',
          aggregations: ['SUM'],
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
      allowedFilterFields: [
        'reason',
        'status',
        'resolution',
        'customerId',
        'warehouseId',
        'requestedAt',
      ],
      requiredPermissions: ['returns.rma.view', 'analytics.query.execute'],
      defaultTimeDimension: 'requestedAt',
      allowedTimeDimensions: ['requestedAt', 'completedAt'],
      modelName: 'returnOrder',
    },

    'service.tickets': {
      definitionKey: 'service.tickets',
      name: 'Customer Support & Service Tickets',
      domain: 'service',
      description:
        'Ticket resolution time, SLA breaches, customer satisfaction, and volume',
      allowedDimensions: [
        'priority',
        'status',
        'category',
        'assignedTeamId',
        'assignedAgentId',
      ],
      allowedMeasures: [
        { name: 'ticketCount', label: 'Ticket Count', aggregations: ['COUNT'] },
        {
          name: 'firstResponseTimeMinutes',
          label: 'First Response Time (mins)',
          aggregations: ['AVG', 'MIN', 'MAX'],
        },
        {
          name: 'resolutionTimeMinutes',
          label: 'Resolution Time (mins)',
          aggregations: ['AVG', 'MIN', 'MAX'],
        },
        { name: 'csatScore', label: 'CSAT Score (1-5)', aggregations: ['AVG'] },
      ],
      supportedAggregations: ['COUNT', 'AVG', 'MIN', 'MAX'],
      allowedFilterFields: [
        'priority',
        'status',
        'category',
        'assignedTeamId',
        'assignedAgentId',
        'createdAt',
        'resolvedAt',
      ],
      requiredPermissions: ['service.tickets.view', 'analytics.query.execute'],
      defaultTimeDimension: 'createdAt',
      allowedTimeDimensions: ['createdAt', 'resolvedAt', 'updatedAt'],
      modelName: 'serviceTicket',
    },

    'finance.invoice': {
      definitionKey: 'finance.invoice',
      name: 'Financial Invoicing & AR/AP Aging',
      domain: 'finance',
      description:
        'Accounts receivable / accounts payable invoice totals, aging brackets, and status',
      allowedDimensions: [
        'invoiceType',
        'status',
        'currency',
        'counterpartyId',
        'paymentTerms',
      ],
      allowedMeasures: [
        {
          name: 'invoiceCount',
          label: 'Total Invoices',
          aggregations: ['COUNT'],
        },
        {
          name: 'totalAmount',
          label: 'Total Amount (cents)',
          aggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
          isCurrency: true,
          unit: 'cents',
        },
        {
          name: 'paidAmount',
          label: 'Paid Amount (cents)',
          aggregations: ['SUM', 'AVG'],
          isCurrency: true,
          unit: 'cents',
        },
        {
          name: 'outstandingAmount',
          label: 'Outstanding Balance (cents)',
          aggregations: ['SUM', 'AVG', 'MAX'],
          isCurrency: true,
          unit: 'cents',
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
      allowedFilterFields: [
        'invoiceType',
        'status',
        'currency',
        'counterpartyId',
        'paymentTerms',
        'dueDate',
        'createdAt',
      ],
      requiredPermissions: [
        'accounting.reports.view',
        'analytics.query.execute',
      ],
      defaultTimeDimension: 'createdAt',
      allowedTimeDimensions: ['createdAt', 'dueDate', 'paidAt'],
      modelName: 'invoice',
    },

    'crm.customer': {
      definitionKey: 'crm.customer',
      name: 'CRM Customer Health & Acquisition',
      domain: 'crm',
      description:
        'Customer lifetime value, account tiers, lifecycle status, and geographic spread',
      allowedDimensions: [
        'tier',
        'lifecycleStage',
        'industry',
        'region',
        'status',
      ],
      allowedMeasures: [
        {
          name: 'customerCount',
          label: 'Total Customers',
          aggregations: ['COUNT'],
        },
        {
          name: 'lifetimeValue',
          label: 'Customer Lifetime Value (cents)',
          aggregations: ['SUM', 'AVG', 'MAX'],
          isCurrency: true,
          unit: 'cents',
        },
        {
          name: 'activeOpportunities',
          label: 'Active Opportunities',
          aggregations: ['SUM', 'COUNT'],
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG', 'MAX'],
      allowedFilterFields: [
        'tier',
        'lifecycleStage',
        'industry',
        'region',
        'status',
        'createdAt',
      ],
      requiredPermissions: ['crm.customers.view', 'analytics.query.execute'],
      defaultTimeDimension: 'createdAt',
      allowedTimeDimensions: ['createdAt', 'updatedAt'],
      modelName: 'customer',
    },

    'workflow.execution': {
      definitionKey: 'workflow.execution',
      name: 'Workflow Automation Telemetry',
      domain: 'workflow',
      description:
        'Automation execution rates, step failures, run durations, and action throughput',
      allowedDimensions: ['workflowId', 'triggerType', 'status', 'environment'],
      allowedMeasures: [
        {
          name: 'executionCount',
          label: 'Total Executions',
          aggregations: ['COUNT'],
        },
        {
          name: 'durationMs',
          label: 'Execution Duration (ms)',
          aggregations: ['AVG', 'MIN', 'MAX'],
        },
        {
          name: 'stepCount',
          label: 'Steps Processed',
          aggregations: ['SUM', 'AVG'],
        },
      ],
      supportedAggregations: ['COUNT', 'AVG', 'MIN', 'MAX', 'SUM'],
      allowedFilterFields: [
        'workflowId',
        'triggerType',
        'status',
        'environment',
        'startedAt',
        'completedAt',
      ],
      requiredPermissions: [
        'workflows.executions.view',
        'analytics.query.execute',
      ],
      defaultTimeDimension: 'startedAt',
      allowedTimeDimensions: ['startedAt', 'completedAt'],
      modelName: 'workflowExecution',
    },

    'notifications.delivery': {
      definitionKey: 'notifications.delivery',
      name: 'Omnichannel Notification Deliveries',
      domain: 'notifications',
      description:
        'Channel delivery volumes, read/click engagement rates, and provider latencies',
      allowedDimensions: ['channel', 'status', 'templateId', 'providerKey'],
      allowedMeasures: [
        {
          name: 'deliveryCount',
          label: 'Deliveries Sent',
          aggregations: ['COUNT'],
        },
        {
          name: 'readCount',
          label: 'Read/Opened Count',
          aggregations: ['SUM', 'COUNT'],
        },
        {
          name: 'deliveryLatencyMs',
          label: 'Delivery Latency (ms)',
          aggregations: ['AVG', 'MAX'],
        },
      ],
      supportedAggregations: ['COUNT', 'SUM', 'AVG', 'MAX'],
      allowedFilterFields: [
        'channel',
        'status',
        'templateId',
        'providerKey',
        'sentAt',
      ],
      requiredPermissions: [
        'notifications.messages.view',
        'analytics.query.execute',
      ],
      defaultTimeDimension: 'sentAt',
      allowedTimeDimensions: ['sentAt', 'createdAt'],
      modelName: 'notificationDelivery',
    },
  };

export class AnalyticsDefinitionRegistry {
  public static getAll(): AnalyticsDefinitionRecord[] {
    return Object.values(ANALYTICS_DEFINITIONS);
  }

  public static get(key: string): AnalyticsDefinitionRecord | undefined {
    return ANALYTICS_DEFINITIONS[key];
  }

  public static has(key: string): boolean {
    return key in ANALYTICS_DEFINITIONS;
  }

  public static getByDomain(domain: string): AnalyticsDefinitionRecord[] {
    return Object.values(ANALYTICS_DEFINITIONS).filter(
      (d) => d.domain === domain,
    );
  }
}
