/**
 * ==============================================================================
 * Deterministic Development Seed Script
 * Milestone M02 - M10: Suppliers & Purchasing Management
 * ==============================================================================
 * IMPORTANT:
 * - This script is for LOCAL DEVELOPMENT ONLY.
 * - The seeded admin password ("Admin123!DevPasswordOnly") is a fixed dev fixture
 *   and MUST NEVER BE USED IN PRODUCTION ENVIRONMENTS.
 * ==============================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Deterministic, valid Argon2id hash for password: "Admin123!DevPasswordOnly"
const DEV_ADMIN_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$QAR1q0Na4GXyxl0LWD37JQ$mIXf/CnLpXs7mMm2S56xq7owQNoJez35HjKhmrOgCr4';

const SYSTEM_PERMISSIONS = [
  {
    name: 'organizations.view',
    description: 'View organization details and profile',
  },
  {
    name: 'organizations.manage',
    description: 'Update organization settings and configuration',
  },
  { name: 'users.view', description: 'View organization members and users' },
  {
    name: 'users.manage',
    description: 'Invite, update, and manage member statuses',
  },
  { name: 'roles.view', description: 'View roles and assigned permissions' },
  {
    name: 'roles.manage',
    description: 'Create, update, and assign roles and permissions',
  },
  {
    name: 'audit.view',
    description: 'View organization audit logs and activity trail',
  },
  // Milestone M07: Master Data Permissions
  {
    name: 'master-data.currencies.view',
    description: 'View global currencies',
  },
  {
    name: 'master-data.currencies.manage',
    description: 'Create, update, and deactivate global currencies',
  },
  {
    name: 'master-data.locations.view',
    description: 'View organization locations',
  },
  {
    name: 'master-data.locations.manage',
    description: 'Create, update, and soft-delete locations',
  },
  {
    name: 'master-data.taxes.view',
    description: 'View organization tax rates',
  },
  {
    name: 'master-data.taxes.manage',
    description: 'Create, update, and archive tax rates',
  },
  {
    name: 'master-data.numbering.view',
    description: 'View numbering sequences',
  },
  {
    name: 'master-data.numbering.manage',
    description: 'Create and update numbering sequences',
  },
  {
    name: 'master-data.numbering.generate',
    description: 'Generate atomic next sequence numbers',
  },
  // Milestone M08: Item & Product Catalog Permissions
  {
    name: 'catalog.categories.view',
    description: 'View product categories',
  },
  {
    name: 'catalog.categories.manage',
    description: 'Create, update, and soft-delete product categories',
  },
  {
    name: 'catalog.units.view',
    description: 'View units of measure',
  },
  {
    name: 'catalog.units.manage',
    description: 'Create, update, and deactivate units of measure',
  },
  {
    name: 'catalog.items.view',
    description: 'View catalog items and products',
  },
  {
    name: 'catalog.items.manage',
    description: 'Create, update, and soft-delete catalog items',
  },
  {
    name: 'catalog.variants.view',
    description: 'View item variants',
  },
  {
    name: 'catalog.variants.manage',
    description: 'Create, update, and soft-delete item variants',
  },
  {
    name: 'catalog.pricing.view',
    description: 'View pricing tiers and item prices',
  },
  {
    name: 'catalog.pricing.manage',
    description: 'Create, update, and delete pricing tiers and prices',
  },
  // Milestone M09: Inventory & Warehouse Permissions
  {
    name: 'inventory.balances.view',
    description: 'View stock balances and availability',
  },
  {
    name: 'inventory.movements.view',
    description: 'View immutable stock movement ledger',
  },
  {
    name: 'inventory.adjustments.manage',
    description: 'Perform stock adjustments (in/out)',
  },
  {
    name: 'inventory.batches.view',
    description: 'View inventory batch and lot records',
  },
  {
    name: 'inventory.batches.manage',
    description: 'Create and update inventory batches',
  },
  {
    name: 'inventory.serials.view',
    description: 'View individual serialized inventory items',
  },
  {
    name: 'inventory.serials.manage',
    description: 'Register and manage inventory serials',
  },
  {
    name: 'inventory.transfers.view',
    description: 'View stock transfers between locations',
  },
  {
    name: 'inventory.transfers.manage',
    description: 'Create, complete, and cancel stock transfers',
  },
  // Milestone M10: Suppliers & Purchasing Permissions
  {
    name: 'purchasing.suppliers.view',
    description: 'View supplier profiles, contacts, and addresses',
  },
  {
    name: 'purchasing.suppliers.manage',
    description:
      'Create, update, and deactivate suppliers, contacts, and addresses',
  },
  {
    name: 'purchasing.orders.view',
    description: 'View purchase orders and line items',
  },
  {
    name: 'purchasing.orders.manage',
    description: 'Create and update draft purchase orders',
  },
  {
    name: 'purchasing.orders.submit',
    description: 'Submit draft purchase orders for review',
  },
  {
    name: 'purchasing.orders.approve',
    description: 'Approve submitted purchase orders',
  },
  {
    name: 'purchasing.orders.cancel',
    description: 'Cancel purchase orders',
  },
  {
    name: 'purchasing.receipts.view',
    description: 'View goods receipts and received lines',
  },
  {
    name: 'purchasing.receipts.manage',
    description: 'Create and update draft goods receipts',
  },
  {
    name: 'purchasing.receipts.post',
    description: 'Post goods receipts and receive stock into inventory',
  },
  {
    name: 'purchasing.receipts.cancel',
    description: 'Cancel draft goods receipts',
  },
  {
    name: 'purchasing.costs.view',
    description: 'View landed cost allocations',
  },
  {
    name: 'purchasing.costs.manage',
    description: 'Create and manage landed cost allocations',
  },
  // Milestone M11: Customers & Sales Order Management Permissions
  {
    name: 'sales.customers.view',
    description: 'View customer profiles, contacts, and addresses',
  },
  {
    name: 'sales.customers.manage',
    description: 'Create, update, and manage customer records',
  },
  {
    name: 'sales.customer-groups.view',
    description: 'View customer groups and segments',
  },
  {
    name: 'sales.customer-groups.manage',
    description: 'Create and manage customer groups',
  },
  {
    name: 'sales.customer-pricing.view',
    description: 'View customer-specific price rules',
  },
  {
    name: 'sales.customer-pricing.manage',
    description: 'Create and manage customer-specific prices',
  },
  {
    name: 'sales.quotations.view',
    description: 'View sales quotations and line items',
  },
  {
    name: 'sales.quotations.manage',
    description: 'Create and update draft sales quotations',
  },
  {
    name: 'sales.quotations.send',
    description: 'Send quotations to customers',
  },
  {
    name: 'sales.quotations.accept',
    description: 'Accept customer quotations',
  },
  {
    name: 'sales.quotations.reject',
    description: 'Reject customer quotations',
  },
  {
    name: 'sales.quotations.cancel',
    description: 'Cancel sales quotations',
  },
  {
    name: 'sales.orders.view',
    description: 'View sales orders and line details',
  },
  {
    name: 'sales.orders.manage',
    description: 'Create and update draft sales orders',
  },
  {
    name: 'sales.orders.submit',
    description: 'Submit sales orders for approval',
  },
  {
    name: 'sales.orders.approve',
    description: 'Approve sales orders with credit validation',
  },
  {
    name: 'sales.orders.allocate',
    description: 'Allocate and reserve inventory for approved sales orders',
  },
  {
    name: 'sales.orders.confirm',
    description: 'Confirm sales orders and reserve inventory',
  },
  {
    name: 'sales.orders.cancel',
    description: 'Cancel sales orders and release reservations',
  },
  {
    name: 'sales.orders.close',
    description: 'Close fulfilled sales orders',
  },
  {
    name: 'sales.reservations.view',
    description: 'View inventory reservations',
  },
  {
    name: 'sales.reservations.manage',
    description: 'Manage inventory reservations',
  },
  {
    name: 'sales.reservations.release',
    description: 'Release inventory reservations',
  },
  {
    name: 'sales.deliveries.view',
    description: 'View delivery orders and fulfillment status',
  },
  {
    name: 'sales.deliveries.manage',
    description: 'Create and update draft delivery orders',
  },
  {
    name: 'sales.deliveries.pick',
    description: 'Mark delivery orders as picked/ready',
  },
  {
    name: 'sales.deliveries.dispatch',
    description: 'Mark delivery orders as dispatched/in transit',
  },
  {
    name: 'sales.deliveries.execute',
    description:
      'Execute delivery orders with atomic stock issue and COGS posting',
  },
  {
    name: 'sales.deliveries.ship',
    description: 'Ship delivery orders and post outbound inventory movements',
  },
  {
    name: 'sales.deliveries.deliver',
    description: 'Mark delivery orders as delivered to customer',
  },
  {
    name: 'sales.deliveries.cancel',
    description: 'Cancel delivery orders',
  },
  {
    name: 'sales.fulfillment.view',
    description: 'View sales fulfillment tracking and order progress',
  },
  {
    name: 'sales.reports.view',
    description: 'View sales order and customer fulfillment reports',
  },
  // Milestone M29: Shipment & Logistics Management Permissions
  {
    name: 'shipping.view',
    description: 'View shipping dashboard, status, and logistics data',
  },
  {
    name: 'shipping.manage',
    description: 'Manage shipping and logistics configurations',
  },
  {
    name: 'shipping.carriers.view',
    description: 'View carrier profiles, contact, and transport information',
  },
  {
    name: 'shipping.carriers.manage',
    description: 'Create, update, and manage shipping carriers and vehicles',
  },
  {
    name: 'shipping.shipments.view',
    description: 'View shipment details, lines, and package information',
  },
  {
    name: 'shipping.shipments.manage',
    description: 'Create and update shipment records',
  },
  {
    name: 'shipping.shipments.prepare',
    description: 'Prepare shipments and mark as ready for transport',
  },
  {
    name: 'shipping.shipments.assign',
    description: 'Assign carriers and vehicles to shipments',
  },
  {
    name: 'shipping.shipments.dispatch',
    description: 'Dispatch shipments and initiate transit',
  },
  {
    name: 'shipping.shipments.track',
    description: 'Add tracking events and update in-transit status',
  },
  {
    name: 'shipping.shipments.deliver',
    description: 'Confirm customer delivery of shipments',
  },
  {
    name: 'shipping.shipments.return',
    description: 'Handle shipment failure and initiate returns',
  },
  {
    name: 'shipping.shipments.cancel',
    description: 'Cancel shipments before dispatch',
  },
  {
    name: 'shipping.shipments.close',
    description: 'Close completed or returned shipments',
  },
  {
    name: 'shipping.reports.view',
    description: 'View shipment, carrier, performance, and cost reports',
  },
  // Milestone M30: Warehouse Operations & Advanced Inventory Control Permissions
  {
    name: 'warehouse.view',
    description: 'View warehouse master data, locations, zones, and tasks',
  },
  {
    name: 'warehouse.manage',
    description: 'Manage warehouse settings, configurations, and operations',
  },
  {
    name: 'warehouse.locations.view',
    description: 'View warehouse location taxonomy, classifications, and zones',
  },
  {
    name: 'warehouse.locations.manage',
    description: 'Create and update warehouse locations and zones',
  },
  {
    name: 'warehouse.tasks.view',
    description: 'View warehouse execution tasks and task board',
  },
  {
    name: 'warehouse.tasks.manage',
    description: 'Create, assign, and update warehouse execution tasks',
  },
  {
    name: 'warehouse.putaway.view',
    description: 'View inbound putaway tasks and history',
  },
  {
    name: 'warehouse.putaway.manage',
    description: 'Create and assign inbound putaway tasks',
  },
  {
    name: 'warehouse.putaway.execute',
    description: 'Execute and complete putaway tasks to storage locations',
  },
  {
    name: 'warehouse.picking.view',
    description: 'View outbound pick tasks and lines',
  },
  {
    name: 'warehouse.picking.manage',
    description: 'Create and assign outbound pick tasks',
  },
  {
    name: 'warehouse.picking.execute',
    description: 'Execute pick tasks and stage picked goods',
  },
  {
    name: 'warehouse.waves.view',
    description: 'View pick waves and wave lines',
  },
  {
    name: 'warehouse.waves.manage',
    description: 'Create and manage pick waves',
  },
  {
    name: 'warehouse.waves.release',
    description: 'Release pick waves for warehouse execution',
  },
  {
    name: 'warehouse.transfers.view',
    description: 'View internal warehouse transfer requests and lines',
  },
  {
    name: 'warehouse.transfers.manage',
    description: 'Create and update internal warehouse transfer requests',
  },
  {
    name: 'warehouse.transfers.approve',
    description: 'Approve or reject internal warehouse transfer requests',
  },
  {
    name: 'warehouse.transfers.execute',
    description: 'Execute and complete internal warehouse stock transfers',
  },
  {
    name: 'warehouse.counts.view',
    description: 'View physical cycle count plans, recounts, and lines',
  },
  {
    name: 'warehouse.counts.manage',
    description: 'Schedule, create, and assign cycle count tasks',
  },
  {
    name: 'warehouse.counts.review',
    description: 'Review physical cycle count results and variances',
  },
  {
    name: 'warehouse.counts.post',
    description: 'Approve and post cycle count inventory adjustments',
  },
  {
    name: 'warehouse.adjustments.view',
    description: 'View warehouse inventory adjustment records',
  },
  {
    name: 'warehouse.adjustments.approve',
    description: 'Approve warehouse inventory adjustment variances',
  },
  {
    name: 'warehouse.adjustments.post',
    description: 'Post approved warehouse inventory adjustments',
  },
  {
    name: 'warehouse.quarantine.view',
    description: 'View quarantined stock lots and inspection records',
  },
  {
    name: 'warehouse.quarantine.manage',
    description: 'Place stock in quarantine or under inspection',
  },
  {
    name: 'warehouse.quarantine.release',
    description: 'Release, hold, scrap, or return quarantined stock',
  },
  {
    name: 'warehouse.replenishment.view',
    description: 'View bin replenishment rules and replenishment tasks',
  },
  {
    name: 'warehouse.replenishment.manage',
    description: 'Create replenishment rules and execute replenishment tasks',
  },
  {
    name: 'warehouse.reports.view',
    description:
      'View warehouse stock, performance, count variance, and accuracy reports',
  },
  // Milestone M31: Quality Management, Inspection & Quality Control Foundation Permissions
  {
    name: 'quality.configuration.view',
    description: 'View organization quality configuration and defaults',
  },
  {
    name: 'quality.configuration.manage',
    description: 'Update organization quality configuration and policies',
  },
  {
    name: 'quality.sampling.view',
    description: 'View sampling plans and sample calculation rules',
  },
  {
    name: 'quality.sampling.manage',
    description: 'Create and manage sampling plans',
  },
  {
    name: 'quality.inspection-plans.view',
    description: 'View quality inspection plans and characteristics',
  },
  {
    name: 'quality.inspection-plans.manage',
    description: 'Create and update quality inspection plans',
  },
  {
    name: 'quality.inspection-plans.approve',
    description: 'Approve and activate quality inspection plans',
  },
  {
    name: 'quality.inspections.view',
    description: 'View quality inspection lots and results',
  },
  {
    name: 'quality.inspections.manage',
    description: 'Create and manage quality inspection lots',
  },
  {
    name: 'quality.inspections.execute',
    description: 'Record sample inspection results and observations',
  },
  {
    name: 'quality.inspections.decide',
    description: 'Make authoritative disposition decisions on inspection lots',
  },
  {
    name: 'quality.holds.view',
    description: 'View active quality holds on inventory',
  },
  {
    name: 'quality.holds.manage',
    description: 'Place inventory on quality hold',
  },
  {
    name: 'quality.holds.release',
    description: 'Release or disposition inventory from quality hold',
  },
  {
    name: 'quality.non-conformance.view',
    description: 'View non-conformance reports (NCRs)',
  },
  {
    name: 'quality.non-conformance.manage',
    description: 'Create and update non-conformance reports',
  },
  {
    name: 'quality.non-conformance.contain',
    description: 'Record containment actions on non-conformance reports',
  },
  {
    name: 'quality.non-conformance.disposition',
    description: 'Disposition non-conformance reports',
  },
  {
    name: 'quality.non-conformance.close',
    description: 'Close non-conformance reports',
  },
  {
    name: 'quality.capa.view',
    description: 'View corrective and preventive action (CAPA) records',
  },
  {
    name: 'quality.capa.manage',
    description: 'Create and update CAPA records and action plans',
  },
  {
    name: 'quality.capa.verify',
    description: 'Verify and review effectiveness of CAPA actions',
  },
  {
    name: 'quality.capa.close',
    description: 'Close verified CAPA records',
  },
  {
    name: 'quality.customer-issues.view',
    description: 'View customer-reported quality issues',
  },
  {
    name: 'quality.customer-issues.manage',
    description: 'Create and manage customer quality issues',
  },
  {
    name: 'quality.customer-issues.resolve',
    description: 'Resolve and close customer quality issues',
  },
  {
    name: 'quality.supplier-quality.view',
    description: 'View supplier quality performance scorecards and metrics',
  },
  {
    name: 'quality.customer-quality.view',
    description: 'View customer quality analytics and RMA metrics',
  },
  {
    name: 'quality.reports.view',
    description: 'View quality summary, pass/fail, hold, and trend reports',
  },
  // Milestone M32: Returns, Reverse Logistics & RMA Foundation Permissions
  {
    name: 'returns.view',
    description: 'View returns and RMA requests',
  },
  {
    name: 'returns.manage',
    description: 'Create and update return requests and policies',
  },
  {
    name: 'returns.submit',
    description: 'Submit return requests for review',
  },
  {
    name: 'returns.review',
    description: 'Review submitted return requests',
  },
  {
    name: 'returns.authorize',
    description: 'Authorize return requests and quantities',
  },
  {
    name: 'returns.reject',
    description: 'Reject return requests',
  },
  {
    name: 'returns.cancel',
    description: 'Cancel return requests',
  },
  {
    name: 'returns.receive',
    description: 'Receive returned physical goods into warehouse',
  },
  {
    name: 'returns.inspection.view',
    description: 'View return quality inspection status',
  },
  {
    name: 'returns.inspection.request',
    description: 'Trigger quality inspection for return goods',
  },
  {
    name: 'returns.disposition.view',
    description: 'View return disposition records',
  },
  {
    name: 'returns.disposition.manage',
    description:
      'Execute return dispositions (restock, scrap, rework, replace)',
  },
  {
    name: 'returns.credit-note',
    description: 'Issue customer credit note for return',
  },
  {
    name: 'returns.refund',
    description: 'Process customer refund for return',
  },
  {
    name: 'returns.debit-note',
    description: 'Issue supplier debit note for return',
  },
  {
    name: 'returns.replace',
    description: 'Trigger replacement fulfillment for return',
  },
  {
    name: 'returns.close',
    description: 'Close completed return requests',
  },
  {
    name: 'returns.void',
    description: 'Void return requests',
  },
  {
    name: 'returns.reports.view',
    description: 'View return analytics and RMA reports',
  },
  // Milestone M12: Accounting & Finance Foundation Permissions
  {
    name: 'accounting.accounts.view',
    description: 'View chart of accounts and general ledger accounts',
  },
  {
    name: 'accounting.accounts.manage',
    description: 'Create, update, and manage accounts in chart of accounts',
  },
  {
    name: 'accounting.periods.view',
    description: 'View fiscal periods and status',
  },
  {
    name: 'accounting.periods.manage',
    description: 'Create and update fiscal periods',
  },
  {
    name: 'accounting.periods.close',
    description: 'Close fiscal periods permanently',
  },
  {
    name: 'accounting.journals.view',
    description: 'View journal entries and lines',
  },
  {
    name: 'accounting.journals.manage',
    description: 'Create and update draft journal entries',
  },
  {
    name: 'accounting.journals.post',
    description: 'Post journal entries to general ledger',
  },
  {
    name: 'accounting.journals.reverse',
    description: 'Create compensating reversal journal entries',
  },
  // Milestone M33: Financial Reporting, Period Close & Management Accounting Permissions
  {
    name: 'accounting.reports.view',
    description:
      'View financial reports, statements, and management accounting dashboards',
  },
  {
    name: 'accounting.reports.trial-balance.view',
    description: 'View trial balance report and account summaries',
  },
  {
    name: 'accounting.reports.general-ledger.view',
    description: 'View general ledger transaction report and account ledger',
  },
  {
    name: 'accounting.reports.profit-loss.view',
    description: 'View profit and loss income statement',
  },
  {
    name: 'accounting.reports.balance-sheet.view',
    description: 'View balance sheet financial statement',
  },
  {
    name: 'accounting.reports.cash-flow.view',
    description: 'View cash flow report and cash movement analysis',
  },
  {
    name: 'accounting.reports.kpis.view',
    description: 'View financial KPIs and executive financial ratios',
  },
  {
    name: 'accounting.reports.reconciliation.view',
    description: 'View subledger to general ledger reconciliation reports',
  },
  {
    name: 'accounting.periods.reopen',
    description:
      'Reopen closed fiscal accounting periods with audit justification',
  },
  {
    name: 'accounting.periods.adjust',
    description: 'Post post-close adjustment entries in closed fiscal periods',
  },
  // Milestone M34: Service Management, Warranty & After-Sales Permissions
  {
    name: 'service.customer-assets.view',
    description:
      'View customer assets, equipment registry, and service history',
  },
  {
    name: 'service.customer-assets.manage',
    description: 'Create, update, and manage customer assets and equipment',
  },
  {
    name: 'service.warranty.view',
    description: 'View warranty policies and asset warranty coverage',
  },
  {
    name: 'service.warranty.manage',
    description: 'Create, configure, and manage warranty policies',
  },
  {
    name: 'service.warranty.validate',
    description: 'Perform warranty eligibility checks and validation',
  },
  {
    name: 'service.requests.view',
    description: 'View service requests and customer inquiries',
  },
  {
    name: 'service.requests.manage',
    description: 'Create, update, and submit service requests',
  },
  {
    name: 'service.requests.triage',
    description: 'Triage service requests and convert to service tickets',
  },
  {
    name: 'service.tickets.view',
    description: 'View service tickets and SLA progress',
  },
  {
    name: 'service.tickets.manage',
    description: 'Manage service tickets lifecycle and progression',
  },
  {
    name: 'service.tickets.assign',
    description: 'Assign technicians to service tickets and orders',
  },
  {
    name: 'service.tickets.diagnose',
    description: 'Perform and finalize technical diagnosis and root cause',
  },
  {
    name: 'service.estimates.view',
    description: 'View service estimates and quotations',
  },
  {
    name: 'service.estimates.manage',
    description: 'Create, update, and send service estimates to customers',
  },
  {
    name: 'service.estimates.approve',
    description: 'Approve or reject service estimates',
  },
  {
    name: 'service.orders.view',
    description: 'View service orders and execution status',
  },
  {
    name: 'service.orders.manage',
    description: 'Create, update, and schedule service orders',
  },
  {
    name: 'service.orders.release',
    description: 'Release service orders for execution',
  },
  {
    name: 'service.orders.execute',
    description: 'Execute service work, reserve parts, and record labor',
  },
  {
    name: 'service.orders.complete',
    description: 'Complete service work and verify quality pass',
  },
  {
    name: 'service.orders.handover',
    description: 'Process customer handover and return serviced asset',
  },
  {
    name: 'service.orders.cancel',
    description: 'Cancel or hold service orders and tickets',
  },
  {
    name: 'service.parts.view',
    description: 'View service part requirements and stock reservations',
  },
  {
    name: 'service.parts.reserve',
    description: 'Reserve warehouse parts for service orders',
  },
  {
    name: 'service.parts.issue',
    description: 'Issue reserved parts from inventory to service orders',
  },
  {
    name: 'service.parts.return',
    description: 'Return unused service parts to warehouse inventory',
  },
  {
    name: 'service.labor.view',
    description: 'View recorded technician labor entries',
  },
  {
    name: 'service.labor.manage',
    description: 'Record, edit, and finalize service labor hours and costs',
  },
  {
    name: 'service.quality.request',
    description: 'Request quality inspection lot for completed service order',
  },
  {
    name: 'service.billing.view',
    description: 'View service billing, costing, and customer invoice links',
  },
  {
    name: 'service.billing.invoice',
    description: 'Generate customer invoice for billable service orders',
  },
  {
    name: 'service.reports.view',
    description: 'View operational service reports, SLA, and summary',
  },
  {
    name: 'service.reports.financial',
    description:
      'View service profitability, revenue, and warranty cost reports',
  },
  {
    name: 'service.reports.sensitive',
    description:
      'View sensitive technician performance and customer complaint analytics',
  },
  // Milestone M35: CRM, Customer Relationship & Sales Pipeline Foundation Permissions
  {
    name: 'crm.leads.view',
    description: 'View CRM leads and prospect information',
  },
  {
    name: 'crm.leads.manage',
    description: 'Create, update, and manage CRM leads',
  },
  {
    name: 'crm.leads.qualify',
    description: 'Qualify or disqualify prospective leads',
  },
  {
    name: 'crm.leads.convert',
    description: 'Convert qualified leads into customers and opportunities',
  },
  {
    name: 'crm.leads.close',
    description: 'Mark leads as lost or closed',
  },
  {
    name: 'crm.contacts.view',
    description: 'View CRM customer contacts',
  },
  {
    name: 'crm.contacts.manage',
    description: 'Create, update, and manage CRM customer contacts',
  },
  {
    name: 'crm.opportunities.view',
    description: 'View sales deal opportunities and pipeline',
  },
  {
    name: 'crm.opportunities.manage',
    description: 'Create, update, and manage sales opportunities and lines',
  },
  {
    name: 'crm.opportunities.assign',
    description: 'Assign opportunities to sales reps and employees',
  },
  {
    name: 'crm.opportunities.stage',
    description: 'Update opportunity pipeline stages and probability',
  },
  {
    name: 'crm.opportunities.close',
    description: 'Close opportunities as won or lost',
  },
  {
    name: 'crm.activities.view',
    description: 'View CRM activities, calls, meetings, and tasks',
  },
  {
    name: 'crm.activities.manage',
    description: 'Create and update CRM activities',
  },
  {
    name: 'crm.activities.complete',
    description: 'Mark CRM activities as completed or cancelled',
  },
  {
    name: 'crm.quotations.view',
    description: 'View sales quotations and proposals',
  },
  {
    name: 'crm.quotations.manage',
    description: 'Create, update, and edit sales quotations',
  },
  {
    name: 'crm.quotations.submit',
    description: 'Submit quotations for internal review',
  },
  {
    name: 'crm.quotations.approve',
    description: 'Approve or reject submitted sales quotations',
  },
  {
    name: 'crm.quotations.send',
    description: 'Send quotations to customer contacts',
  },
  {
    name: 'crm.quotations.accept',
    description: 'Record customer acceptance of quotations',
  },
  {
    name: 'crm.quotations.convert',
    description: 'Convert accepted quotations into authoritative Sales Orders',
  },
  {
    name: 'crm.pipeline.view',
    description:
      'View sales pipeline forecasting, weighted pipeline, and metrics',
  },
  {
    name: 'crm.customer-360.view',
    description: 'View 360-degree unified customer profile and history',
  },
  {
    name: 'crm.reports.view',
    description: 'View CRM analytics, funnel, conversion, and revenue reports',
  },
  // Milestone M36: Platform Performance, Scalability & Concurrency Permissions
  {
    name: 'system.jobs.view',
    description: 'View background execution jobs and status',
  },
  {
    name: 'system.jobs.manage',
    description: 'Create and cancel background execution jobs',
  },
  {
    name: 'system.benchmarks.run',
    description: 'Trigger performance benchmarking suites',
  },
  // Milestone M37: Security, Compliance & Platform Hardening Permissions
  {
    name: 'security.view',
    description: 'View security dashboard and high-level posture',
  },
  {
    name: 'security.events.view',
    description: 'View categorized security audit events',
  },
  {
    name: 'security.sessions.view',
    description: 'View active user sessions and device registry',
  },
  {
    name: 'security.sessions.revoke',
    description: 'Revoke active user sessions and trigger global logout',
  },
  {
    name: 'security.policies.view',
    description:
      'View tenant security policies, lockout, and password settings',
  },
  {
    name: 'security.policies.manage',
    description: 'Update tenant security policies and rate limits',
  },
  {
    name: 'security.reports.view',
    description: 'View security compliance and threat intelligence reports',
  },
  {
    name: 'security.incidents.view',
    description: 'View security incident timeline and alerts',
  },
  {
    name: 'security.incidents.manage',
    description: 'Manage and triage security incidents and account lockouts',
  },
  {
    name: 'security.audit.export',
    description: 'Export immutable security audit logs',
  },
  {
    name: 'security.admin',
    description: 'Full administrative security capabilities',
  },
  // Milestone M38: Platform Observability, Reliability & Operational Excellence Permissions
  {
    name: 'operations.view',
    description: 'View operations dashboard and platform health summary',
  },
  {
    name: 'operations.health.view',
    description: 'View detailed health checks for all platform dependencies',
  },
  {
    name: 'operations.metrics.view',
    description: 'View platform-level operational metrics and KPIs',
  },
  {
    name: 'operations.errors.view',
    description: 'View operational error records and error trends',
  },
  {
    name: 'operations.jobs.view',
    description: 'View background job telemetry and queue depth',
  },
  {
    name: 'operations.jobs.manage',
    description: 'Manage background job lifecycle and cancel stuck jobs',
  },
  {
    name: 'operations.cache.view',
    description: 'View cache hit rates, miss rates, and cache metrics',
  },
  {
    name: 'operations.security.view',
    description: 'View security telemetry summary in operations context',
  },
  {
    name: 'operations.incidents.view',
    description: 'View operational incidents and incident timeline',
  },
  {
    name: 'operations.incidents.manage',
    description:
      'Create, acknowledge, resolve, and close operational incidents',
  },
  {
    name: 'operations.alerts.view',
    description: 'View alert rules and triggered alert events',
  },
  {
    name: 'operations.alerts.manage',
    description: 'Create and manage operational alert rules',
  },
  {
    name: 'operations.slo.view',
    description: 'View Service Level Objectives and compliance status',
  },
  {
    name: 'operations.reports.view',
    description:
      'View operational reports including availability and performance',
  },
  {
    name: 'operations.admin',
    description:
      'Full administrative access to all platform observability capabilities',
  },
  // Milestone M39: Integration Platform, Webhooks & External API
  {
    name: 'integrations.providers.view',
    description: 'View available integration provider catalog',
  },
  {
    name: 'integrations.connections.view',
    description: 'View integration connections and their status',
  },
  {
    name: 'integrations.connections.manage',
    description: 'Create, update, and delete integration connections',
  },
  {
    name: 'integrations.credentials.manage',
    description: 'Manage encrypted credentials for integration connections',
  },
  {
    name: 'integrations.apikeys.view',
    description: 'View API keys (prefix and metadata only, never hash)',
  },
  {
    name: 'integrations.apikeys.manage',
    description: 'Create, rotate, and revoke API keys',
  },
  {
    name: 'integrations.webhooks.view',
    description: 'View outbound webhook subscriptions and delivery history',
  },
  {
    name: 'integrations.webhooks.manage',
    description: 'Create, update, and delete outbound webhook subscriptions',
  },
  {
    name: 'integrations.events.view',
    description: 'View integration event log',
  },
  {
    name: 'integrations.inbound.view',
    description: 'View inbound webhook events from external providers',
  },
  {
    name: 'integrations.inbound.manage',
    description: 'Manage inbound webhook processing and retry policies',
  },
  {
    name: 'integrations.health.view',
    description: 'View integration health status and diagnostics',
  },
  {
    name: 'integrations.audit.view',
    description: 'View integration audit trail and security events',
  },
  {
    name: 'integrations.admin',
    description:
      'Full administrative access to all integration platform capabilities',
  },
  // Milestone M40: Workflow Automation, Rules Engine & Business Process Orchestration
  {
    name: 'workflows.view',
    description: 'View workflow definitions, versions, and configurations',
  },
  {
    name: 'workflows.manage',
    description: 'Manage workflow definitions and graph configurations',
  },
  {
    name: 'workflows.create',
    description: 'Create new workflow definitions and drafts',
  },
  {
    name: 'workflows.update',
    description: 'Update workflow drafts and settings',
  },
  {
    name: 'workflows.publish',
    description: 'Validate and publish workflow versions',
  },
  {
    name: 'workflows.retire',
    description: 'Retire published workflow versions',
  },
  {
    name: 'workflows.execute',
    description: 'Trigger workflow executions manually or via API',
  },
  {
    name: 'workflows.cancel',
    description: 'Cancel active or waiting workflow executions',
  },
  {
    name: 'workflows.retry',
    description: 'Retry failed workflow executions',
  },
  {
    name: 'workflows.rules.view',
    description: 'View declarative rules and condition expressions',
  },
  {
    name: 'workflows.rules.manage',
    description: 'Manage declarative rule definitions',
  },
  {
    name: 'workflows.rules.test',
    description: 'Test and evaluate rules with sample context',
  },
  {
    name: 'workflows.approvals.view',
    description: 'View workflow approval requests and history',
  },
  {
    name: 'workflows.approvals.approve',
    description: 'Approve pending workflow approval requests',
  },
  {
    name: 'workflows.approvals.reject',
    description: 'Reject pending workflow approval requests',
  },
  {
    name: 'workflows.approvals.delegate',
    description: 'Delegate workflow approvals to another user',
  },
  {
    name: 'workflows.schedules.view',
    description: 'View scheduled workflows and next run times',
  },
  {
    name: 'workflows.schedules.manage',
    description: 'Create, update, enable, and disable schedules',
  },
  {
    name: 'workflows.executions.view',
    description: 'View workflow executions, steps, and timeline logs',
  },
  {
    name: 'workflows.executions.manage',
    description: 'Manage workflow executions, compensation, and cleanup',
  },
  {
    name: 'workflows.reports.view',
    description: 'View workflow analytics and operational reports',
  },
  {
    name: 'workflows.admin',
    description:
      'Full administrative access to all workflow automation capabilities',
  },
  // Milestone M41: Public API Platform, Developer Portal & SDK Foundation
  {
    name: 'developer.view',
    description: 'Access developer platform dashboard and overview',
  },
  {
    name: 'developer.api.view',
    description: 'View public API endpoint specifications and metadata',
  },
  {
    name: 'developer.api.explorer',
    description: 'Execute interactive API requests in developer explorer',
  },
  {
    name: 'developer.api.usage.view',
    description: 'View API usage metrics, rate limits, and telemetry',
  },
  {
    name: 'developer.api.errors.view',
    description: 'Inspect API errors and troubleshooting diagnostics',
  },
  {
    name: 'developer.api.keys.view',
    description: 'View API key metadata and prefixes',
  },
  {
    name: 'developer.api.keys.manage',
    description: 'Generate, rotate, and revoke API keys',
  },
  {
    name: 'developer.api.docs.view',
    description: 'View OpenAPI documentation and client SDK contracts',
  },
  {
    name: 'developer.webhooks.view',
    description: 'View webhook integration documentation and schemas',
  },
  {
    name: 'developer.versions.view',
    description: 'View API versioning, stability, and deprecation status',
  },
  {
    name: 'developer.usage.export',
    description: 'Export API usage telemetry to CSV',
  },
  {
    name: 'developer.admin',
    description: 'Full administrative access to developer platform settings',
  },
  // Milestone M42: SaaS Billing, Subscriptions, Entitlements & Usage Metering
  {
    name: 'billing.read',
    description: 'View tenant billing overview and basic subscription status',
  },
  {
    name: 'billing.plans.read',
    description: 'View public and active SaaS plan catalog and pricing tiers',
  },
  {
    name: 'billing.plans.manage',
    description: 'Create, update, version, and publish SaaS billing plans',
  },
  {
    name: 'billing.subscription.read',
    description: 'View subscription status, renewal date, and billing period',
  },
  {
    name: 'billing.subscription.manage',
    description: 'Create, upgrade, downgrade, pause, and cancel subscriptions',
  },
  {
    name: 'billing.invoices.read',
    description: 'View tenant invoices, line items, and payment status',
  },
  {
    name: 'billing.invoices.manage',
    description: 'Generate, finalize, void, and adjust tenant invoices',
  },
  {
    name: 'billing.payments.read',
    description: 'View billing payment history and transaction records',
  },
  {
    name: 'billing.usage.read',
    description: 'View metered usage metrics, aggregates, and quota status',
  },
  {
    name: 'billing.usage.export',
    description: 'Export usage metering and consumption telemetry data',
  },
  {
    name: 'billing.entitlements.read',
    description: 'View feature entitlements, limits, and remaining allowances',
  },
  {
    name: 'billing.credits.manage',
    description: 'Grant, revoke, and adjust tenant billing credits',
  },
  {
    name: 'billing.discounts.manage',
    description: 'Create, update, and apply coupon codes and discounts',
  },
  {
    name: 'billing.providers.manage',
    description: 'Configure and monitor external billing provider gateways',
  },
  {
    name: 'billing.reports.read',
    description: 'Access SaaS commercial and operational billing reports',
  },
  {
    name: 'billing.admin',
    description: 'Full administrative access to all SaaS billing operations',
  },
  // Milestone M43: Notifications, Communications & Omnichannel Messaging
  {
    name: 'notifications.read',
    description: 'View tenant in-app notifications and delivery status',
  },
  {
    name: 'notifications.manage',
    description: 'Manage notification lifecycle, mark read, and archive',
  },
  {
    name: 'notifications.send',
    description: 'Dispatch transactional and operational notifications',
  },
  {
    name: 'notifications.templates.read',
    description: 'View notification template catalog and published versions',
  },
  {
    name: 'notifications.templates.manage',
    description: 'Create, update, version, and publish notification templates',
  },
  {
    name: 'notifications.preferences.read',
    description: 'View user and tenant notification preferences and policies',
  },
  {
    name: 'notifications.preferences.manage',
    description: 'Update communication channels, quiet hours, and policies',
  },
  {
    name: 'notifications.providers.read',
    description: 'View communication provider gateways and health status',
  },
  {
    name: 'notifications.providers.manage',
    description: 'Configure communication providers, credentials, and failover',
  },
  {
    name: 'notifications.deliveries.read',
    description: 'View delivery timeline, attempts, and sanitized errors',
  },
  {
    name: 'notifications.deliveries.manage',
    description: 'Retry, resend, or cancel pending notification deliveries',
  },
  {
    name: 'notifications.schedules.read',
    description: 'View scheduled and recurring notification queues',
  },
  {
    name: 'notifications.schedules.manage',
    description: 'Schedule, reschedule, or cancel future notifications',
  },
  {
    name: 'notifications.reports.read',
    description: 'Access omnichannel communication analytics and reports',
  },
  {
    name: 'notifications.admin',
    description:
      'Full administrative access to all communication platform operations',
  },
  // Milestone M44: Unified Search, Discovery & Saved Views Permissions
  {
    name: 'search.read',
    description: 'Execute basic searches across authorized domain scopes',
  },
  {
    name: 'search.execute',
    description: 'Execute unified global and scoped search queries',
  },
  {
    name: 'search.history.read',
    description: 'View own personal search query history',
  },
  {
    name: 'search.history.manage',
    description: 'Manage and clear own personal search query history',
  },
  {
    name: 'search.favorites.read',
    description: 'View starred and favorited discovery items',
  },
  {
    name: 'search.favorites.manage',
    description: 'Add, update, and remove favorited discovery items',
  },
  {
    name: 'search.views.read',
    description: 'Access personal, shared, and tenant saved views',
  },
  {
    name: 'search.views.manage',
    description: 'Create, update, and delete saved views and column configs',
  },
  {
    name: 'search.views.share',
    description: 'Share saved views with team members, roles, or tenant',
  },
  {
    name: 'search.alerts.read',
    description: 'View automated search alert rules and execution logs',
  },
  {
    name: 'search.alerts.manage',
    description: 'Create, pause, resume, and manage automated search alerts',
  },
  {
    name: 'search.analytics.read',
    description: 'View privacy-safe search telemetry, trends, and reports',
  },
  {
    name: 'search.admin',
    description:
      'Full administrative access to search configuration and index definitions',
  },
  // Milestone M45: Analytics, Reporting & Business Intelligence Foundation
  {
    name: 'analytics.definitions.view',
    description: 'View analytics dataset definitions and catalog',
  },
  {
    name: 'analytics.query.execute',
    description: 'Execute analytics queries across domain datasets',
  },
  {
    name: 'analytics.reports.view',
    description: 'View saved reports',
  },
  {
    name: 'analytics.reports.create',
    description: 'Create saved reports',
  },
  {
    name: 'analytics.reports.update',
    description: 'Update saved reports',
  },
  {
    name: 'analytics.reports.delete',
    description: 'Delete saved reports',
  },
  {
    name: 'analytics.reports.share',
    description: 'Share saved reports with users, roles, or teams',
  },
  {
    name: 'analytics.reports.export',
    description: 'Export analytics query and report results (CSV/JSON)',
  },
  {
    name: 'analytics.schedules.manage',
    description: 'Configure automated report generation schedules',
  },
  {
    name: 'analytics.dashboards.view',
    description: 'View analytics dashboards and widgets',
  },
  {
    name: 'analytics.dashboards.manage',
    description: 'Create, update, and delete analytics dashboards and widgets',
  },
  {
    name: 'analytics.admin',
    description:
      'Full administrative access to analytics configuration and usage telemetry',
  },
  // Milestone M46: Data Export, Import & Bulk Operations Platform Permissions
  {
    name: 'data_operations.operations.view',
    description: 'View registered data operation definitions and templates',
  },
  {
    name: 'data_operations.export.execute',
    description: 'Execute and download tenant data exports',
  },
  {
    name: 'data_operations.import.preview',
    description:
      'Upload and dry-run preview data imports without persistent mutation',
  },
  {
    name: 'data_operations.import.execute',
    description: 'Commit and execute batch data imports to persistent storage',
  },
  {
    name: 'data_operations.jobs.view',
    description: 'View data operation execution jobs and progress status',
  },
  {
    name: 'data_operations.jobs.cancel',
    description: 'Cancel in-flight data operation jobs',
  },
  {
    name: 'data_operations.templates.manage',
    description: 'Create and configure data operation mapping templates',
  },
  {
    name: 'data_operations.restricted_fields.export',
    description: 'Export elevated and restricted domain fields',
  },
  {
    name: 'data_operations.audit.view',
    description: 'View row-level error reports and bulk operation audit logs',
  },
  {
    name: 'data_operations.admin',
    description:
      'Full administrative control over data export, import, and bulk operations',
  },
  // Milestone M13: Accounts Payable & Supplier Invoicing Permissions
  {
    name: 'ap.suppliers.view',
    description: 'View accounts payable supplier profiles and balances',
  },
  {
    name: 'ap.invoices.view',
    description: 'View supplier invoices and line details',
  },
  {
    name: 'ap.invoices.manage',
    description: 'Create and update draft supplier invoices',
  },
  {
    name: 'ap.invoices.submit',
    description: 'Submit draft supplier invoices for approval',
  },
  {
    name: 'ap.invoices.approve',
    description: 'Approve submitted supplier invoices',
  },
  {
    name: 'ap.invoices.post',
    description: 'Post approved supplier invoices to general ledger',
  },
  {
    name: 'ap.invoices.cancel',
    description: 'Cancel supplier invoices',
  },
  {
    name: 'ap.invoices.void',
    description: 'Void posted supplier invoices with accounting reversal',
  },
  {
    name: 'ap.matching.view',
    description: 'View three-way matching results and variances',
  },
  {
    name: 'ap.account-mapping.view',
    description: 'View accounts payable account mapping configuration',
  },
  {
    name: 'ap.account-mapping.manage',
    description: 'Manage accounts payable account mapping configuration',
  },
  // Milestone M14: Accounts Receivable & Customer Invoicing Permissions
  {
    name: 'sales.invoices.view',
    description: 'View customer invoices and line details',
  },
  {
    name: 'sales.invoices.manage',
    description: 'Create and update draft customer invoices',
  },
  {
    name: 'sales.invoices.issue',
    description: 'Issue customer invoices and post to general ledger',
  },
  {
    name: 'sales.invoices.void',
    description: 'Void issued customer invoices with accounting reversal',
  },
  {
    name: 'sales.receivables.view',
    description: 'View accounts receivable customer balances',
  },
  {
    name: 'sales.receivables.aging',
    description: 'View accounts receivable aging reports',
  },
  // Milestone M15: Payments, Receipts & Settlement Permissions
  {
    name: 'finance.payments.view',
    description: 'View payment accounts, payments, and allocations',
  },
  {
    name: 'finance.payments.manage',
    description: 'Create and manage payment accounts and draft payments',
  },
  {
    name: 'finance.payments.post',
    description: 'Post payments to the general ledger',
  },
  {
    name: 'finance.payments.allocate',
    description: 'Allocate payments against customer and supplier invoices',
  },
  {
    name: 'finance.payments.void',
    description: 'Void posted payments and reverse settlements',
  },
  {
    name: 'finance.receipts.view',
    description: 'View customer receipts',
  },
  {
    name: 'finance.receipts.manage',
    description: 'Create customer receipts',
  },
  {
    name: 'finance.receipts.post',
    description: 'Post customer receipts to general ledger',
  },
  {
    name: 'finance.supplier-payments.view',
    description: 'View supplier payments',
  },
  {
    name: 'finance.supplier-payments.manage',
    description: 'Create supplier payments',
  },
  {
    name: 'finance.supplier-payments.post',
    description: 'Post supplier payments to general ledger',
  },
  {
    name: 'finance.settlements.view',
    description: 'View unallocated payments and settlement balances',
  },
  {
    name: 'finance.settlements.manage',
    description: 'Manage invoice settlement allocations',
  },
  // Milestone M16: Bank Reconciliation & Cash Management Permissions
  {
    name: 'banking.accounts.view',
    description: 'View bank account profiles and metadata',
  },
  {
    name: 'banking.accounts.manage',
    description: 'Create and manage bank account profiles',
  },
  {
    name: 'banking.statements.view',
    description: 'View bank statements and imported transactions',
  },
  {
    name: 'banking.statements.import',
    description: 'Import bank statement transactions',
  },
  {
    name: 'banking.statements.manage',
    description: 'Create and manage bank statements',
  },
  {
    name: 'banking.reconciliation.view',
    description: 'View bank reconciliation sessions',
  },
  {
    name: 'banking.reconciliation.manage',
    description: 'Create and manage bank reconciliation sessions',
  },
  {
    name: 'banking.reconciliation.match',
    description: 'Match bank transactions against payments and journal entries',
  },
  {
    name: 'banking.reconciliation.complete',
    description: 'Complete and lock bank reconciliations',
  },
  {
    name: 'banking.adjustments.manage',
    description: 'Post bank charge and interest adjustments to general ledger',
  },
  // Milestone M17: Financial Reporting & Trial Balance Permissions
  {
    name: 'accounting.reports.view',
    description: 'View financial reports and accounting ledger drill-downs',
  },
  {
    name: 'accounting.trial-balance.view',
    description: 'View General Ledger Trial Balance reports',
  },
  {
    name: 'accounting.general-ledger.view',
    description: 'View detailed Account General Ledger and running balances',
  },
  {
    name: 'accounting.balance-sheet.view',
    description: 'View Balance Sheet financial statements',
  },
  {
    name: 'accounting.income-statement.view',
    description: 'View Income Statement / Profit & Loss financial statements',
  },
  {
    name: 'accounting.cash-flow.view',
    description: 'View Cash Flow financial statements',
  },
  // Milestone M18: Credit Notes, Debit Notes & Refunds Permissions
  {
    name: 'sales.credit-notes.view',
    description: 'View customer credit notes and applications',
  },
  {
    name: 'sales.credit-notes.manage',
    description: 'Create and update customer credit notes',
  },
  {
    name: 'sales.credit-notes.approve',
    description: 'Approve customer credit notes',
  },
  {
    name: 'sales.credit-notes.post',
    description:
      'Post customer credit notes to the general ledger and inventory',
  },
  {
    name: 'sales.credit-notes.apply',
    description: 'Apply customer credit notes against customer invoices',
  },
  {
    name: 'sales.credit-notes.void',
    description: 'Void customer credit notes',
  },
  {
    name: 'sales.refunds.view',
    description: 'View customer refunds',
  },
  {
    name: 'sales.refunds.manage',
    description: 'Create and update customer refunds',
  },
  {
    name: 'sales.refunds.post',
    description: 'Post customer refunds to the general ledger',
  },
  {
    name: 'sales.refunds.void',
    description: 'Void customer refunds',
  },
  {
    name: 'purchasing.debit-notes.view',
    description: 'View supplier debit notes and applications',
  },
  {
    name: 'purchasing.debit-notes.manage',
    description: 'Create and update supplier debit notes',
  },
  {
    name: 'purchasing.debit-notes.approve',
    description: 'Approve supplier debit notes',
  },
  {
    name: 'purchasing.debit-notes.post',
    description: 'Post supplier debit notes to the general ledger',
  },
  {
    name: 'purchasing.debit-notes.apply',
    description: 'Apply supplier debit notes against supplier invoices',
  },
  {
    name: 'purchasing.debit-notes.void',
    description: 'Void supplier debit notes',
  },
  {
    name: 'purchasing.refunds.view',
    description: 'View supplier refunds',
  },
  {
    name: 'purchasing.refunds.manage',
    description: 'Create and manage supplier refunds',
  },
  {
    name: 'purchasing.refunds.post',
    description: 'Post supplier refunds to the general ledger',
  },
  {
    name: 'purchasing.refunds.void',
    description: 'Void supplier refunds',
  },
  // Milestone M19: Inventory Valuation, Costing & COGS Permissions
  {
    name: 'inventory.valuation.view',
    description: 'View inventory valuation reports and summaries',
  },
  {
    name: 'inventory.costing.view',
    description: 'View item costing history and cost layers',
  },
  {
    name: 'inventory.costing.manage',
    description:
      'Manage inventory costing, cost recalculations, and valuation adjustments',
  },
  {
    name: 'inventory.cogs.view',
    description: 'View Cost of Goods Sold (COGS) reports and records',
  },
  // Milestone M20: Tax, VAT & Compliance Permissions
  {
    name: 'tax.codes.view',
    description: 'View tax codes and settings',
  },
  {
    name: 'tax.codes.manage',
    description: 'Create and manage tax codes',
  },
  {
    name: 'tax.rates.view',
    description: 'View effective-dated tax rates',
  },
  {
    name: 'tax.rates.manage',
    description: 'Create and manage effective-dated tax rates',
  },
  {
    name: 'tax.rules.view',
    description: 'View tax determination rules',
  },
  {
    name: 'tax.rules.manage',
    description: 'Create and manage tax determination rules',
  },
  {
    name: 'tax.jurisdictions.view',
    description: 'View tax jurisdictions',
  },
  {
    name: 'tax.jurisdictions.manage',
    description: 'Create and manage tax jurisdictions',
  },
  {
    name: 'tax.calculation.view',
    description: 'Execute and view tax calculations',
  },
  {
    name: 'tax.reports.view',
    description: 'View tax and compliance reports and ledgers',
  },
  {
    name: 'tax.periods.view',
    description: 'View tax filing periods and summaries',
  },
  {
    name: 'tax.periods.manage',
    description: 'Create and prepare tax periods',
  },
  {
    name: 'tax.periods.lock',
    description: 'Lock and finalize tax periods',
  },
  // Milestone M21: Expense Management & Employee Reimbursements Permissions
  {
    name: 'expenses.categories.view',
    description: 'View expense categories',
  },
  {
    name: 'expenses.categories.manage',
    description: 'Create, update, and manage expense categories',
  },
  {
    name: 'expenses.claimants.view',
    description: 'View employee expense claimant profiles',
  },
  {
    name: 'expenses.claimants.manage',
    description: 'Create and manage employee expense claimant profiles',
  },
  {
    name: 'expenses.claims.view',
    description: 'View expense claims',
  },
  {
    name: 'expenses.claims.manage',
    description: 'Create and draft expense claims',
  },
  {
    name: 'expenses.claims.submit',
    description: 'Submit expense claims for review and approval',
  },
  {
    name: 'expenses.claims.approve',
    description: 'Approve or reject submitted expense claims',
  },
  {
    name: 'expenses.claims.post',
    description: 'Post approved expense claims to the General Ledger',
  },
  {
    name: 'expenses.claims.cancel',
    description: 'Cancel pre-posting expense claims',
  },
  {
    name: 'expenses.claims.void',
    description: 'Void posted expense claims with compensating reversal',
  },
  {
    name: 'expenses.reimbursements.view',
    description: 'View employee expense reimbursements and payment records',
  },
  {
    name: 'expenses.reimbursements.manage',
    description: 'Process and record employee expense reimbursement payments',
  },
  {
    name: 'expenses.reports.view',
    description:
      'View expense summaries, category reports, and reimbursement aging',
  },
  {
    name: 'assets.categories.view',
    description: 'View asset categories and configuration',
  },
  {
    name: 'assets.categories.manage',
    description: 'Create, update, and manage asset categories',
  },
  {
    name: 'assets.view',
    description: 'View fixed assets, details, and schedules',
  },
  {
    name: 'assets.manage',
    description: 'Create and edit draft fixed assets',
  },
  {
    name: 'assets.capitalize',
    description: 'Capitalize fixed assets and trigger initial GL postings',
  },
  {
    name: 'assets.transfer',
    description: 'Transfer fixed assets between locations',
  },
  {
    name: 'assets.dispose',
    description: 'Dispose fixed assets and post gain/loss accounting entries',
  },
  {
    name: 'assets.void',
    description: 'Void fixed assets and reverse accounting postings',
  },
  {
    name: 'assets.depreciation.view',
    description: 'View depreciation schedules, runs, and entries',
  },
  {
    name: 'assets.depreciation.manage',
    description: 'Execute periodic depreciation runs and post GL entries',
  },
  {
    name: 'assets.reports.view',
    description:
      'View fixed asset register, depreciation, movement, and reconciliation reports',
  },
  // Milestone M23: Budgeting, Financial Planning & Budget Control Permissions
  {
    name: 'accounting.budgets.view',
    description: 'View budgets, allocation lines, and versions',
  },
  {
    name: 'accounting.budgets.manage',
    description: 'Create, update, and manage draft budgets and lines',
  },
  {
    name: 'accounting.budgets.submit',
    description: 'Submit draft budgets for approval',
  },
  {
    name: 'accounting.budgets.approve',
    description: 'Approve or reject submitted budgets',
  },
  {
    name: 'accounting.budgets.activate',
    description: 'Activate approved budgets',
  },
  {
    name: 'accounting.budgets.close',
    description: 'Close active budgets',
  },
  {
    name: 'accounting.budgets.cancel',
    description: 'Cancel draft or submitted budgets',
  },
  {
    name: 'accounting.budgets.vs-actual.view',
    description: 'View Budget vs Actual comparisons and drill-downs',
  },
  {
    name: 'accounting.budgets.control.view',
    description: 'Check budget availability and spending limits',
  },
  {
    name: 'accounting.budgets.alerts.view',
    description: 'View budget threshold alerts and variance notifications',
  },
  // Milestone M24: Payroll, Employee & HR Management Permissions
  {
    name: 'hr.employees.view',
    description: 'View employees, basic profiles, and directory',
  },
  {
    name: 'hr.employees.manage',
    description:
      'Create, update, and manage employee master records and compensations',
  },
  {
    name: 'hr.departments.view',
    description: 'View organization departments and hierarchy',
  },
  {
    name: 'hr.departments.manage',
    description: 'Create and manage departments',
  },
  {
    name: 'hr.positions.view',
    description: 'View job positions and designations',
  },
  {
    name: 'hr.positions.manage',
    description: 'Create and manage job positions',
  },
  {
    name: 'payroll.configuration.view',
    description: 'View payroll settings and accounting mappings',
  },
  {
    name: 'payroll.configuration.manage',
    description: 'Configure payroll frequency, accounts, and policies',
  },
  {
    name: 'payroll.components.view',
    description: 'View earnings, deductions, and tax payroll components',
  },
  {
    name: 'payroll.components.manage',
    description: 'Create and manage payroll components and rules',
  },
  {
    name: 'payroll.periods.view',
    description: 'View payroll period schedules and status',
  },
  {
    name: 'payroll.periods.manage',
    description: 'Create and manage payroll periods and inputs',
  },
  {
    name: 'payroll.calculate',
    description: 'Execute payroll calculations and generate snapshots',
  },
  {
    name: 'payroll.approve',
    description: 'Approve or reject calculated payroll runs',
  },
  {
    name: 'payroll.post',
    description: 'Post approved payroll runs to General Ledger',
  },
  {
    name: 'payroll.pay',
    description: 'Execute employee salary payments and settlement',
  },
  {
    name: 'payroll.close',
    description: 'Close and lock completed payroll periods',
  },
  {
    name: 'payroll.cancel',
    description: 'Cancel draft or calculated payroll periods',
  },
  {
    name: 'payroll.reports.view',
    description: 'View standard payroll summaries and department reports',
  },
  {
    name: 'payroll.reports.sensitive',
    description:
      'View confidential employee compensation, tax, and salary history',
  },
  {
    name: 'payroll.budget-control.view',
    description: 'Verify payroll budget availability and spending limits',
  },
  // Milestone M25: Manufacturing & Production Management Permissions
  {
    name: 'manufacturing.boms.view',
    description: 'View Bills of Materials (BOM) and component recipes',
  },
  {
    name: 'manufacturing.boms.manage',
    description: 'Create, update, and manage Bill of Materials definitions',
  },
  {
    name: 'manufacturing.boms.activate',
    description: 'Activate, deactivate, or archive Bill of Materials versions',
  },
  {
    name: 'manufacturing.orders.view',
    description: 'View production orders and manufacturing status',
  },
  {
    name: 'manufacturing.orders.manage',
    description: 'Create, edit, and manage production orders',
  },
  {
    name: 'manufacturing.orders.release',
    description: 'Release planned production orders to shop floor',
  },
  {
    name: 'manufacturing.orders.start',
    description: 'Start released production orders into active execution',
  },
  {
    name: 'manufacturing.orders.issue',
    description: 'Issue raw materials and components to production orders',
  },
  {
    name: 'manufacturing.orders.complete',
    description: 'Record finished goods receipts and partial completions',
  },
  {
    name: 'manufacturing.orders.cancel',
    description: 'Cancel draft or released production orders',
  },
  {
    name: 'manufacturing.orders.close',
    description:
      'Finalize and close completed production orders and record variance',
  },
  {
    name: 'manufacturing.planning.view',
    description:
      'View production demand, material availability, and shortage analysis',
  },
  {
    name: 'manufacturing.costing.view',
    description:
      'View production costing, WIP valuation, and manufacturing variance',
  },
  {
    name: 'manufacturing.reports.view',
    description:
      'View manufacturing summary, material consumption, and WIP reports',
  },
  {
    name: 'manufacturing.configuration.manage',
    description: 'Configure manufacturing GL accounts and release policies',
  },
  // Milestone M26: Material Requirements Planning (MRP) & Supply Planning Permissions
  {
    name: 'planning.runs.view',
    description: 'View MRP planning runs, parameters, and status',
  },
  {
    name: 'planning.runs.manage',
    description: 'Create, update, and cancel MRP planning runs',
  },
  {
    name: 'planning.runs.execute',
    description: 'Execute MRP planning runs and compute net requirements',
  },
  {
    name: 'planning.results.view',
    description:
      'View calculated MRP planning results and demand/supply snapshots',
  },
  {
    name: 'planning.shortages.view',
    description: 'View material shortages and critical planning exceptions',
  },
  {
    name: 'planning.reports.view',
    description:
      'View MRP summaries, demand/supply matrices, and planned order reports',
  },
  {
    name: 'planning.configuration.view',
    description: 'View tenant planning configurations and item profiles',
  },
  {
    name: 'planning.configuration.manage',
    description:
      'Manage tenant planning policies, safety stock, and item profiles',
  },
  {
    name: 'planning.planned-orders.view',
    description: 'View planned procurement and production recommendations',
  },
  // Milestone M27: Procurement & Purchase Order Management Permissions
  {
    name: 'procurement.requisitions.view',
    description: 'View purchase requisitions and item requests',
  },
  {
    name: 'procurement.requisitions.manage',
    description: 'Create, update, submit, and convert purchase requisitions',
  },
  {
    name: 'procurement.requisitions.approve',
    description: 'Approve or reject submitted purchase requisitions',
  },
  {
    name: 'procurement.orders.view',
    description: 'View purchase orders, lines, and fulfillment status',
  },
  {
    name: 'procurement.orders.manage',
    description: 'Create, edit, send, acknowledge, and close purchase orders',
  },
  {
    name: 'procurement.orders.approve',
    description: 'Approve or reject purchase orders with budget authorization',
  },
  {
    name: 'procurement.receipts.view',
    description: 'View goods receipts and incoming delivery lines',
  },
  {
    name: 'procurement.receipts.manage',
    description: 'Receive purchase orders, create and post goods receipts',
  },
  {
    name: 'procurement.returns.view',
    description: 'View purchase returns and supplier debit references',
  },
  {
    name: 'procurement.returns.manage',
    description: 'Create and post purchase returns to suppliers',
  },
  {
    name: 'procurement.reports.view',
    description:
      'View procurement summaries, open orders, spend, and supplier reports',
  },
];

const GLOBAL_CURRENCIES = [
  {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimalPlaces: 2,
    isActive: true,
  },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, isActive: true },
  {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    decimalPlaces: 2,
    isActive: true,
  },
  {
    code: 'BDT',
    name: 'Bangladeshi Taka',
    symbol: '৳',
    decimalPlaces: 2,
    isActive: true,
  },
  {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    decimalPlaces: 2,
    isActive: true,
  },
  {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    decimalPlaces: 0,
    isActive: true,
  },
  {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    decimalPlaces: 2,
    isActive: true,
  },
  {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'AU$',
    decimalPlaces: 2,
    isActive: true,
  },
];

async function main(): Promise<void> {
  console.log('🌱 Starting deterministic development database seed...');

  // 1. Seed Global System Permissions (Upsert for idempotency)
  console.log('  → Seeding system permissions...');
  const seededPermissions: Record<string, string> = {};
  for (const perm of SYSTEM_PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: perm,
    });
    seededPermissions[perm.name] = record.id;
  }

  // 2. Seed Global Currencies
  console.log('  → Seeding global currencies...');
  for (const curr of GLOBAL_CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: curr.code },
      update: {
        name: curr.name,
        symbol: curr.symbol,
        decimalPlaces: curr.decimalPlaces,
        isActive: curr.isActive,
      },
      create: curr,
    });
  }

  // 3. Seed Global System Roles (isSystem = true, organizationId = null)
  console.log('  → Seeding system roles...');
  const systemRoles = [
    {
      name: 'OWNER',
      description: 'Organization Owner with complete administrative authority',
      isSystem: true,
      permissions: Object.keys(seededPermissions),
    },
    {
      name: 'ADMIN',
      description:
        'Organization Administrator with operational management privileges',
      isSystem: true,
      permissions: [
        'organizations.view',
        'organizations.manage',
        'users.view',
        'users.manage',
        'roles.view',
        'audit.view',
        'master-data.currencies.view',
        'master-data.locations.view',
        'master-data.locations.manage',
        'master-data.taxes.view',
        'master-data.taxes.manage',
        'master-data.numbering.view',
        'master-data.numbering.manage',
        'master-data.numbering.generate',
        'catalog.categories.view',
        'catalog.categories.manage',
        'catalog.units.view',
        'catalog.units.manage',
        'catalog.items.view',
        'catalog.items.manage',
        'catalog.variants.view',
        'catalog.variants.manage',
        'catalog.pricing.view',
        'catalog.pricing.manage',
        'inventory.balances.view',
        'inventory.movements.view',
        'inventory.adjustments.manage',
        'inventory.batches.view',
        'inventory.batches.manage',
        'inventory.serials.view',
        'inventory.serials.manage',
        'inventory.transfers.view',
        'inventory.transfers.manage',
        'purchasing.suppliers.view',
        'purchasing.suppliers.manage',
        'purchasing.orders.view',
        'purchasing.orders.manage',
        'purchasing.orders.submit',
        'purchasing.orders.approve',
        'purchasing.orders.cancel',
        'purchasing.receipts.view',
        'purchasing.receipts.manage',
        'purchasing.receipts.post',
        'purchasing.receipts.cancel',
        'purchasing.costs.view',
        'purchasing.costs.manage',
        'sales.customers.view',
        'sales.customers.manage',
        'sales.customer-groups.view',
        'sales.customer-groups.manage',
        'sales.customer-pricing.view',
        'sales.customer-pricing.manage',
        'sales.quotations.view',
        'sales.quotations.manage',
        'sales.quotations.send',
        'sales.quotations.accept',
        'sales.quotations.reject',
        'sales.quotations.cancel',
        'sales.orders.view',
        'sales.orders.manage',
        'sales.orders.submit',
        'sales.orders.approve',
        'sales.orders.allocate',
        'sales.orders.confirm',
        'sales.orders.cancel',
        'sales.orders.close',
        'sales.reservations.view',
        'sales.reservations.manage',
        'sales.reservations.release',
        'sales.deliveries.view',
        'sales.deliveries.manage',
        'sales.deliveries.pick',
        'sales.deliveries.dispatch',
        'sales.deliveries.execute',
        'sales.deliveries.ship',
        'sales.deliveries.deliver',
        'sales.deliveries.cancel',
        'sales.fulfillment.view',
        'sales.reports.view',
        'shipping.view',
        'shipping.manage',
        'shipping.carriers.view',
        'shipping.carriers.manage',
        'shipping.shipments.view',
        'shipping.shipments.manage',
        'shipping.shipments.prepare',
        'shipping.shipments.assign',
        'shipping.shipments.dispatch',
        'shipping.shipments.track',
        'shipping.shipments.deliver',
        'shipping.shipments.return',
        'shipping.shipments.cancel',
        'shipping.shipments.close',
        'shipping.reports.view',
        'warehouse.view',
        'warehouse.manage',
        'warehouse.locations.view',
        'warehouse.locations.manage',
        'warehouse.tasks.view',
        'warehouse.tasks.manage',
        'warehouse.putaway.view',
        'warehouse.putaway.manage',
        'warehouse.putaway.execute',
        'warehouse.picking.view',
        'warehouse.picking.manage',
        'warehouse.picking.execute',
        'warehouse.waves.view',
        'warehouse.waves.manage',
        'warehouse.waves.release',
        'warehouse.transfers.view',
        'warehouse.transfers.manage',
        'warehouse.transfers.approve',
        'warehouse.transfers.execute',
        'warehouse.counts.view',
        'warehouse.counts.manage',
        'warehouse.counts.review',
        'warehouse.counts.post',
        'warehouse.adjustments.view',
        'warehouse.adjustments.approve',
        'warehouse.adjustments.post',
        'warehouse.quarantine.view',
        'warehouse.quarantine.manage',
        'warehouse.quarantine.release',
        'warehouse.replenishment.view',
        'warehouse.replenishment.manage',
        'warehouse.reports.view',
        'quality.configuration.view',
        'quality.configuration.manage',
        'quality.sampling.view',
        'quality.sampling.manage',
        'quality.inspection-plans.view',
        'quality.inspection-plans.manage',
        'quality.inspection-plans.approve',
        'quality.inspections.view',
        'quality.inspections.manage',
        'quality.inspections.execute',
        'quality.inspections.decide',
        'quality.holds.view',
        'quality.holds.manage',
        'quality.holds.release',
        'quality.non-conformance.view',
        'quality.non-conformance.manage',
        'quality.non-conformance.contain',
        'quality.non-conformance.disposition',
        'quality.non-conformance.close',
        'quality.capa.view',
        'quality.capa.manage',
        'quality.capa.verify',
        'quality.capa.close',
        'quality.customer-issues.view',
        'quality.customer-issues.manage',
        'quality.customer-issues.resolve',
        'quality.supplier-quality.view',
        'quality.customer-quality.view',
        'quality.reports.view',
        'returns.view',
        'returns.manage',
        'returns.submit',
        'returns.review',
        'returns.authorize',
        'returns.reject',
        'returns.cancel',
        'returns.receive',
        'returns.inspection.view',
        'returns.inspection.request',
        'returns.disposition.view',
        'returns.disposition.manage',
        'returns.credit-note',
        'returns.refund',
        'returns.debit-note',
        'returns.replace',
        'returns.close',
        'returns.void',
        'returns.reports.view',
        'accounting.accounts.view',
        'accounting.accounts.manage',
        'accounting.periods.view',
        'accounting.periods.manage',
        'accounting.periods.close',
        'accounting.periods.reopen',
        'accounting.periods.adjust',
        'service.customer-assets.view',
        'service.customer-assets.manage',
        'service.warranty.view',
        'service.warranty.manage',
        'service.warranty.validate',
        'service.requests.view',
        'service.requests.manage',
        'service.requests.triage',
        'service.tickets.view',
        'service.tickets.manage',
        'service.tickets.assign',
        'service.tickets.diagnose',
        'service.estimates.view',
        'service.estimates.manage',
        'service.estimates.approve',
        'service.orders.view',
        'service.orders.manage',
        'service.orders.release',
        'service.orders.execute',
        'service.orders.complete',
        'service.orders.handover',
        'service.orders.cancel',
        'service.parts.view',
        'service.parts.reserve',
        'service.parts.issue',
        'service.parts.return',
        'service.labor.view',
        'service.labor.manage',
        'service.quality.request',
        'service.billing.view',
        'service.billing.invoice',
        'service.reports.view',
        'service.reports.financial',
        'service.reports.sensitive',
        'crm.leads.view',
        'crm.leads.manage',
        'crm.leads.qualify',
        'crm.leads.convert',
        'crm.leads.close',
        'crm.contacts.view',
        'crm.contacts.manage',
        'crm.opportunities.view',
        'crm.opportunities.manage',
        'crm.opportunities.assign',
        'crm.opportunities.stage',
        'crm.opportunities.close',
        'crm.activities.view',
        'crm.activities.manage',
        'crm.activities.complete',
        'crm.quotations.view',
        'crm.quotations.manage',
        'crm.quotations.submit',
        'crm.quotations.approve',
        'crm.quotations.send',
        'crm.quotations.accept',
        'crm.quotations.convert',
        'crm.pipeline.view',
        'crm.customer-360.view',
        'crm.reports.view',
        'system.jobs.view',
        'system.jobs.manage',
        'system.benchmarks.run',
        'security.view',
        'security.events.view',
        'security.sessions.view',
        'security.sessions.revoke',
        'security.policies.view',
        'security.policies.manage',
        'security.reports.view',
        'security.incidents.view',
        'security.incidents.manage',
        'security.audit.export',
        'security.admin',
        // M38 — Operations
        'operations.view',
        'operations.health.view',
        'operations.metrics.view',
        'operations.errors.view',
        'operations.jobs.view',
        'operations.jobs.manage',
        'operations.cache.view',
        'operations.security.view',
        'operations.incidents.view',
        'operations.incidents.manage',
        'operations.alerts.view',
        'operations.alerts.manage',
        'operations.slo.view',
        'operations.reports.view',
        'operations.admin',
        'integrations.providers.view',
        'integrations.connections.view',
        'integrations.connections.manage',
        'integrations.credentials.manage',
        'integrations.apikeys.view',
        'integrations.apikeys.manage',
        'integrations.webhooks.view',
        'integrations.webhooks.manage',
        'integrations.events.view',
        'integrations.inbound.view',
        'integrations.inbound.manage',
        'integrations.health.view',
        'integrations.audit.view',
        'integrations.admin',
        'workflows.view',
        'workflows.manage',
        'workflows.create',
        'workflows.update',
        'workflows.publish',
        'workflows.retire',
        'workflows.execute',
        'workflows.cancel',
        'workflows.retry',
        'workflows.rules.view',
        'workflows.rules.manage',
        'workflows.rules.test',
        'workflows.approvals.view',
        'workflows.approvals.approve',
        'workflows.approvals.reject',
        'workflows.approvals.delegate',
        'workflows.schedules.view',
        'workflows.schedules.manage',
        'workflows.executions.view',
        'workflows.executions.manage',
        'workflows.reports.view',
        'workflows.admin',
        'developer.view',
        'developer.api.view',
        'developer.api.explorer',
        'developer.api.usage.view',
        'developer.api.errors.view',
        'developer.api.keys.view',
        'developer.api.keys.manage',
        'developer.api.docs.view',
        'developer.webhooks.view',
        'developer.versions.view',
        'developer.usage.export',
        'developer.admin',
        'billing.read',
        'billing.plans.read',
        'billing.plans.manage',
        'billing.subscription.read',
        'billing.subscription.manage',
        'billing.invoices.read',
        'billing.invoices.manage',
        'billing.payments.read',
        'billing.usage.read',
        'billing.usage.export',
        'billing.entitlements.read',
        'billing.credits.manage',
        'billing.discounts.manage',
        'billing.providers.manage',
        'billing.reports.read',
        'billing.admin',
        'notifications.read',
        'notifications.manage',
        'notifications.send',
        'notifications.templates.read',
        'notifications.templates.manage',
        'notifications.preferences.read',
        'notifications.preferences.manage',
        'notifications.providers.read',
        'notifications.providers.manage',
        'notifications.deliveries.read',
        'notifications.deliveries.manage',
        'notifications.schedules.read',
        'notifications.schedules.manage',
        'notifications.reports.read',
        'notifications.admin',
        'search.read',
        'search.execute',
        'search.history.read',
        'search.history.manage',
        'search.favorites.read',
        'search.favorites.manage',
        'search.views.read',
        'search.views.manage',
        'search.views.share',
        'search.alerts.read',
        'search.alerts.manage',
        'search.analytics.read',
        'search.admin',
        'analytics.definitions.view',
        'analytics.query.execute',
        'analytics.reports.view',
        'analytics.reports.create',
        'analytics.reports.update',
        'analytics.reports.delete',
        'analytics.reports.share',
        'analytics.reports.export',
        'analytics.schedules.manage',
        'analytics.dashboards.view',
        'analytics.dashboards.manage',
        'analytics.admin',
        'data_operations.operations.view',
        'data_operations.export.execute',
        'data_operations.import.preview',
        'data_operations.import.execute',
        'data_operations.jobs.view',
        'data_operations.jobs.cancel',
        'data_operations.templates.manage',
        'data_operations.restricted_fields.export',
        'data_operations.audit.view',
        'data_operations.admin',
        'accounting.reports.view',
        'accounting.reports.trial-balance.view',
        'accounting.reports.general-ledger.view',
        'accounting.reports.profit-loss.view',
        'accounting.reports.balance-sheet.view',
        'accounting.reports.cash-flow.view',
        'accounting.reports.kpis.view',
        'accounting.reports.reconciliation.view',
        'accounting.journals.view',
        'accounting.journals.manage',
        'accounting.journals.post',
        'accounting.journals.reverse',
        'ap.suppliers.view',
        'ap.invoices.view',
        'ap.invoices.manage',
        'ap.invoices.submit',
        'ap.invoices.approve',
        'ap.invoices.post',
        'ap.invoices.cancel',
        'ap.invoices.void',
        'ap.matching.view',
        'ap.account-mapping.view',
        'ap.account-mapping.manage',
        'sales.invoices.view',
        'sales.invoices.manage',
        'sales.invoices.issue',
        'sales.invoices.void',
        'sales.receivables.view',
        'sales.receivables.aging',
        'finance.payments.view',
        'finance.payments.manage',
        'finance.payments.post',
        'finance.payments.allocate',
        'finance.payments.void',
        'finance.receipts.view',
        'finance.receipts.manage',
        'finance.receipts.post',
        'finance.supplier-payments.view',
        'finance.supplier-payments.manage',
        'finance.supplier-payments.post',
        'finance.settlements.view',
        'finance.settlements.manage',
        'banking.accounts.view',
        'banking.accounts.manage',
        'banking.statements.view',
        'banking.statements.import',
        'banking.statements.manage',
        'banking.reconciliation.view',
        'banking.reconciliation.manage',
        'banking.reconciliation.match',
        'banking.reconciliation.complete',
        'banking.adjustments.manage',
        'accounting.reports.view',
        'accounting.trial-balance.view',
        'accounting.general-ledger.view',
        'accounting.balance-sheet.view',
        'accounting.income-statement.view',
        'accounting.cash-flow.view',
        'sales.credit-notes.view',
        'sales.credit-notes.manage',
        'sales.credit-notes.approve',
        'sales.credit-notes.post',
        'sales.credit-notes.apply',
        'sales.credit-notes.void',
        'sales.refunds.view',
        'sales.refunds.manage',
        'sales.refunds.post',
        'sales.refunds.void',
        'purchasing.debit-notes.view',
        'purchasing.debit-notes.manage',
        'purchasing.debit-notes.approve',
        'purchasing.debit-notes.post',
        'purchasing.debit-notes.apply',
        'purchasing.debit-notes.void',
        'purchasing.refunds.view',
        'purchasing.refunds.manage',
        'purchasing.refunds.post',
        'purchasing.refunds.void',
        'inventory.valuation.view',
        'inventory.costing.view',
        'inventory.costing.manage',
        'inventory.cogs.view',
        'tax.codes.view',
        'tax.codes.manage',
        'tax.rates.view',
        'tax.rates.manage',
        'tax.rules.view',
        'tax.rules.manage',
        'tax.jurisdictions.view',
        'tax.jurisdictions.manage',
        'tax.calculation.view',
        'tax.reports.view',
        'tax.periods.view',
        'tax.periods.manage',
        'tax.periods.lock',
        'expenses.categories.view',
        'expenses.categories.manage',
        'expenses.claimants.view',
        'expenses.claimants.manage',
        'expenses.claims.view',
        'expenses.claims.manage',
        'expenses.claims.submit',
        'expenses.claims.approve',
        'expenses.claims.post',
        'expenses.claims.cancel',
        'expenses.claims.void',
        'expenses.reimbursements.view',
        'expenses.reimbursements.manage',
        'expenses.reports.view',
        'assets.categories.view',
        'assets.categories.manage',
        'assets.view',
        'assets.manage',
        'assets.capitalize',
        'assets.transfer',
        'assets.dispose',
        'assets.void',
        'assets.depreciation.view',
        'assets.depreciation.manage',
        'assets.reports.view',
        'accounting.budgets.view',
        'accounting.budgets.manage',
        'accounting.budgets.submit',
        'accounting.budgets.approve',
        'accounting.budgets.activate',
        'accounting.budgets.close',
        'accounting.budgets.cancel',
        'accounting.budgets.vs-actual.view',
        'accounting.budgets.control.view',
        'accounting.budgets.alerts.view',
        'hr.employees.view',
        'hr.employees.manage',
        'hr.departments.view',
        'hr.departments.manage',
        'hr.positions.view',
        'hr.positions.manage',
        'payroll.configuration.view',
        'payroll.configuration.manage',
        'payroll.components.view',
        'payroll.components.manage',
        'payroll.periods.view',
        'payroll.periods.manage',
        'payroll.calculate',
        'payroll.approve',
        'payroll.post',
        'payroll.pay',
        'payroll.close',
        'payroll.cancel',
        'payroll.reports.view',
        'payroll.reports.sensitive',
        'payroll.budget-control.view',
        'manufacturing.boms.view',
        'manufacturing.boms.manage',
        'manufacturing.boms.activate',
        'manufacturing.orders.view',
        'manufacturing.orders.manage',
        'manufacturing.orders.release',
        'manufacturing.orders.start',
        'manufacturing.orders.issue',
        'manufacturing.orders.complete',
        'manufacturing.orders.cancel',
        'manufacturing.orders.close',
        'manufacturing.planning.view',
        'manufacturing.costing.view',
        'manufacturing.reports.view',
        'manufacturing.configuration.manage',
        'planning.runs.view',
        'planning.runs.manage',
        'planning.runs.execute',
        'planning.results.view',
        'planning.shortages.view',
        'planning.reports.view',
        'planning.configuration.view',
        'planning.configuration.manage',
        'planning.planned-orders.view',
        'procurement.requisitions.view',
        'procurement.requisitions.manage',
        'procurement.requisitions.approve',
        'procurement.orders.view',
        'procurement.orders.manage',
        'procurement.orders.approve',
        'procurement.receipts.view',
        'procurement.receipts.manage',
        'procurement.returns.view',
        'procurement.returns.manage',
        'procurement.reports.view',
      ],
    },
    {
      name: 'VIEWER',
      description: 'Read-only access to organization resources',
      isSystem: true,
      permissions: [
        'organizations.view',
        'users.view',
        'roles.view',
        'master-data.currencies.view',
        'master-data.locations.view',
        'master-data.taxes.view',
        'master-data.numbering.view',
        'catalog.categories.view',
        'catalog.units.view',
        'catalog.items.view',
        'catalog.variants.view',
        'catalog.pricing.view',
        'inventory.balances.view',
        'inventory.movements.view',
        'inventory.batches.view',
        'inventory.serials.view',
        'inventory.transfers.view',
        'purchasing.suppliers.view',
        'purchasing.orders.view',
        'purchasing.receipts.view',
        'purchasing.costs.view',
        'sales.customers.view',
        'sales.customer-groups.view',
        'sales.customer-pricing.view',
        'sales.quotations.view',
        'sales.orders.view',
        'sales.reservations.view',
        'sales.deliveries.view',
        'sales.fulfillment.view',
        'sales.reports.view',
        'shipping.view',
        'shipping.carriers.view',
        'shipping.shipments.view',
        'shipping.reports.view',
        'warehouse.view',
        'warehouse.locations.view',
        'warehouse.tasks.view',
        'warehouse.putaway.view',
        'warehouse.picking.view',
        'warehouse.waves.view',
        'warehouse.transfers.view',
        'warehouse.counts.view',
        'warehouse.adjustments.view',
        'warehouse.quarantine.view',
        'warehouse.replenishment.view',
        'warehouse.reports.view',
        'quality.configuration.view',
        'quality.sampling.view',
        'quality.inspection-plans.view',
        'quality.inspections.view',
        'quality.holds.view',
        'quality.non-conformance.view',
        'quality.capa.view',
        'quality.customer-issues.view',
        'quality.supplier-quality.view',
        'quality.customer-quality.view',
        'quality.reports.view',
        'accounting.accounts.view',
        'accounting.periods.view',
        'accounting.journals.view',
        'ap.suppliers.view',
        'ap.invoices.view',
        'ap.matching.view',
        'ap.account-mapping.view',
        'sales.invoices.view',
        'sales.receivables.view',
        'sales.receivables.aging',
        'finance.payments.view',
        'finance.receipts.view',
        'finance.supplier-payments.view',
        'finance.settlements.view',
        'banking.accounts.view',
        'banking.statements.view',
        'banking.reconciliation.view',
        'accounting.reports.view',
        'accounting.trial-balance.view',
        'accounting.general-ledger.view',
        'accounting.balance-sheet.view',
        'accounting.income-statement.view',
        'accounting.cash-flow.view',
        'sales.credit-notes.view',
        'sales.refunds.view',
        'purchasing.debit-notes.view',
        'purchasing.refunds.view',
        'inventory.valuation.view',
        'inventory.costing.view',
        'inventory.cogs.view',
        'tax.codes.view',
        'tax.rates.view',
        'tax.rules.view',
        'tax.jurisdictions.view',
        'tax.calculation.view',
        'tax.reports.view',
        'tax.periods.view',
        'expenses.categories.view',
        'expenses.claimants.view',
        'expenses.claims.view',
        'expenses.reimbursements.view',
        'expenses.reports.view',
        'assets.categories.view',
        'assets.view',
        'assets.depreciation.view',
        'assets.reports.view',
        'accounting.budgets.view',
        'accounting.budgets.vs-actual.view',
        'accounting.budgets.control.view',
        'accounting.budgets.alerts.view',
        'hr.employees.view',
        'hr.departments.view',
        'hr.positions.view',
        'payroll.configuration.view',
        'payroll.components.view',
        'payroll.periods.view',
        'payroll.reports.view',
        'payroll.budget-control.view',
        'manufacturing.boms.view',
        'manufacturing.orders.view',
        'manufacturing.planning.view',
        'manufacturing.costing.view',
        'manufacturing.reports.view',
        'planning.runs.view',
        'planning.results.view',
        'planning.shortages.view',
        'planning.reports.view',
        'planning.configuration.view',
        'planning.planned-orders.view',
        'procurement.requisitions.view',
        'procurement.orders.view',
        'procurement.receipts.view',
        'procurement.returns.view',
        'procurement.reports.view',
        'returns.view',
        'returns.inspection.view',
        'returns.disposition.view',
        'returns.reports.view',
        'accounting.accounts.view',
        'accounting.periods.view',
        'accounting.journals.view',
        'accounting.reports.view',
        'accounting.reports.trial-balance.view',
        'accounting.reports.general-ledger.view',
        'accounting.reports.profit-loss.view',
        'accounting.reports.balance-sheet.view',
        'accounting.reports.cash-flow.view',
        'accounting.reports.kpis.view',
        'accounting.reports.reconciliation.view',
        'service.customer-assets.view',
        'service.warranty.view',
        'service.requests.view',
        'service.tickets.view',
        'service.estimates.view',
        'service.orders.view',
        'service.parts.view',
        'service.labor.view',
        'service.billing.view',
        'service.reports.view',
        'crm.leads.view',
        'crm.contacts.view',
        'crm.opportunities.view',
        'crm.activities.view',
        'crm.quotations.view',
        'crm.pipeline.view',
        'crm.customer-360.view',
        'crm.reports.view',
        'system.jobs.view',
      ],
    },
  ];

  const seededRoles: Record<string, string> = {};
  for (const roleDef of systemRoles) {
    // Find or create global system role
    let role = await prisma.role.findFirst({
      where: {
        name: roleDef.name,
        organizationId: null,
      },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          organizationId: null,
        },
      });
    }

    seededRoles[roleDef.name] = role.id;

    // Bind Role Permissions
    for (const permName of roleDef.permissions) {
      const permissionId = seededPermissions[permName];
      if (permissionId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId,
          },
        });
      }
    }
  }

  // 4. Seed Development Organization (Tenant)
  console.log('  → Seeding demo development organization...');
  const devOrg = await prisma.organization.upsert({
    where: { slug: 'acme-dev' },
    update: { name: 'Acme Operations Ltd' },
    create: {
      name: 'Acme Operations Ltd',
      slug: 'acme-dev',
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'USD',
          timezone: 'UTC',
          fiscalYearStart: 1,
          customFields: {
            industry: 'Manufacturing & Distribution',
            environment: 'development',
          },
        },
      },
    },
  });

  // Ensure organization settings exist if org already existed
  await prisma.organizationSetting.upsert({
    where: { organizationId: devOrg.id },
    update: {},
    create: {
      organizationId: devOrg.id,
      currency: 'USD',
      timezone: 'UTC',
      fiscalYearStart: 1,
    },
  });

  // 5. Seed Development Admin User (Global Identity)
  console.log('  → Seeding development admin user (admin@example.com)...');
  const devUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash: DEV_ADMIN_PASSWORD_HASH,
      status: 'ACTIVE',
    },
    create: {
      email: 'admin@example.com',
      passwordHash: DEV_ADMIN_PASSWORD_HASH,
      status: 'ACTIVE',
    },
  });

  // 6. Seed Organization Membership (Link User -> Acme Org)
  console.log('  → Linking admin user to organization as OWNER...');
  const membership = await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: devOrg.id,
        userId: devUser.id,
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      organizationId: devOrg.id,
      userId: devUser.id,
      status: 'ACTIVE',
    },
  });

  // 7. Assign OWNER Role to Membership
  const ownerRoleId = seededRoles['OWNER'];
  if (ownerRoleId) {
    await prisma.memberRole.upsert({
      where: {
        memberId_roleId: {
          memberId: membership.id,
          roleId: ownerRoleId,
        },
      },
      update: {},
      create: {
        memberId: membership.id,
        roleId: ownerRoleId,
      },
    });
  }

  // 8. Seed Initial System Audit Log
  await prisma.auditLog.create({
    data: {
      organizationId: devOrg.id,
      actorUserId: devUser.id,
      action: 'ORGANIZATION_INITIALIZED',
      resource: 'organization',
      resourceId: devOrg.id,
      details: {
        seededAt: new Date().toISOString(),
        environment: 'development',
        message: 'Development seed executed successfully.',
      },
    },
  });

  console.log('✅ Deterministic seed completed successfully!');
  console.log('   • Organization : Acme Operations Ltd (slug: acme-dev)');
  console.log('   • Admin User   : admin@example.com');
  console.log(
    '   • Dev Password : Admin123!DevPasswordOnly (DEVELOPMENT ONLY)',
  );
  console.log('   • Role Assigned: OWNER');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
