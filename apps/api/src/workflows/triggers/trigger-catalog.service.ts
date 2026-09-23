import { Injectable, BadRequestException } from '@nestjs/common';

export interface SupportedEventDefinition {
  eventType: string;
  category: string;
  description: string;
  samplePayload: Record<string, unknown>;
}

@Injectable()
export class TriggerCatalogService {
  private readonly supportedEvents: Map<string, SupportedEventDefinition> =
    new Map();

  constructor() {
    this.registerEvents([
      {
        eventType: 'sales.order.created',
        category: 'Sales',
        description:
          'Emitted when a new sales order is created in draft or pending state',
        samplePayload: {
          orderId: 'so-123',
          customerId: 'cust-1',
          total: 15000,
          currency: 'USD',
        },
      },
      {
        eventType: 'sales.order.confirmed',
        category: 'Sales',
        description:
          'Emitted when a sales order is confirmed and approved for fulfillment',
        samplePayload: { orderId: 'so-123', total: 15000, itemsCount: 4 },
      },
      {
        eventType: 'customer.created',
        category: 'CRM',
        description: 'Emitted when a new customer account is created',
        samplePayload: {
          customerId: 'cust-1',
          name: 'Acme Corp',
          tier: 'ENTERPRISE',
        },
      },
      {
        eventType: 'invoice.created',
        category: 'Accounting',
        description: 'Emitted when an accounts receivable invoice is generated',
        samplePayload: {
          invoiceId: 'inv-101',
          amount: 2450.0,
          dueDate: '2026-10-01',
        },
      },
      {
        eventType: 'invoice.posted',
        category: 'Accounting',
        description:
          'Emitted when an invoice is formally posted to the General Ledger',
        samplePayload: { invoiceId: 'inv-101', postedBy: 'user-1' },
      },
      {
        eventType: 'payment.received',
        category: 'Payments',
        description:
          'Emitted when a customer payment or settlement is received',
        samplePayload: {
          paymentId: 'pay-501',
          amount: 2450.0,
          method: 'BANK_TRANSFER',
        },
      },
      {
        eventType: 'shipment.dispatched',
        category: 'Shipping',
        description: 'Emitted when carrier picks up goods for delivery',
        samplePayload: {
          shipmentId: 'shp-88',
          carrier: 'FedEx',
          trackingNumber: 'TRK998877',
        },
      },
      {
        eventType: 'shipment.delivered',
        category: 'Shipping',
        description: 'Emitted when carrier marks shipment as delivered',
        samplePayload: {
          shipmentId: 'shp-88',
          deliveredAt: '2026-09-04T08:30:00Z',
        },
      },
      {
        eventType: 'inventory.adjusted',
        category: 'Inventory',
        description:
          'Emitted when a manual or cycle count stock adjustment occurs',
        samplePayload: { itemId: 'item-10', locationId: 'loc-1', variance: -5 },
      },
      {
        eventType: 'return.created',
        category: 'Returns',
        description: 'Emitted when a customer RMA request is initiated',
        samplePayload: {
          rmaNumber: 'RMA-0012',
          reason: 'DEFECTIVE',
          value: 340,
        },
      },
      {
        eventType: 'service.order.created',
        category: 'Service',
        description: 'Emitted when a field service ticket or order is opened',
        samplePayload: { serviceOrderId: 'srv-400', priority: 'HIGH' },
      },
      {
        eventType: 'crm.opportunity.won',
        category: 'CRM',
        description: 'Emitted when an opportunity is moved to Closed-Won',
        samplePayload: { opportunityId: 'opp-99', dealSize: 120000 },
      },
      {
        eventType: 'quotation.accepted',
        category: 'CRM',
        description: 'Emitted when a client formally accepts a quotation',
        samplePayload: { quotationId: 'q-505', customerId: 'cust-1' },
      },
      {
        eventType: 'quality.inspection.failed',
        category: 'Quality',
        description:
          'Emitted when incoming or in-process quality inspection rejects a lot',
        samplePayload: { inspectionId: 'ins-77', defectRate: 15.2 },
      },
    ]);
  }

  private registerEvents(defs: SupportedEventDefinition[]) {
    for (const def of defs) {
      this.supportedEvents.set(def.eventType, def);
    }
  }

  listSupportedEvents(): SupportedEventDefinition[] {
    return Array.from(this.supportedEvents.values());
  }

  isSupportedEvent(eventType: string): boolean {
    return this.supportedEvents.has(eventType);
  }

  assertSupportedEvent(eventType: string): void {
    if (!this.isSupportedEvent(eventType)) {
      throw new BadRequestException(
        `Unsupported event type "${eventType}". Must be a registered public integration event (INV-389)`,
      );
    }
  }
}
