export type ShipmentStatus =
  | "DRAFT"
  | "READY"
  | "ASSIGNED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"
  | "CANCELLED"
  | "CLOSED";

export type CarrierType =
  "COURIER" | "TRANSPORT_COMPANY" | "FREIGHT_FORWARDER" | "INTERNAL" | "OTHER";

export type ShipmentTrackingEventType =
  | "CREATED"
  | "READY"
  | "ASSIGNED"
  | "DISPATCHED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_ATTEMPT_FAILED"
  | "RETURN_INITIATED"
  | "RETURNED"
  | "CANCELLED";

export interface ShipmentCarrier {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  carrierType: CarrierType;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  trackingUrlTemplate?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentLine {
  id: string;
  shipmentId: string;
  deliveryOrderLineId: string;
  salesOrderLineId: string;
  itemId: string;
  variantId?: string | null;
  quantity: string | number;
  unitOfMeasure?: string | null;
  packageReference?: string | null;
  batchReference?: string | null;
  serialReference?: string | null;
  item?: {
    id: string;
    sku: string;
    name: string;
  };
  variant?: {
    id: string;
    sku: string;
    name?: string | null;
  } | null;
}

export interface ShipmentPackage {
  id: string;
  shipmentId: string;
  packageNumber: string;
  packageType?: string | null;
  weight?: string | number | null;
  weightUnit?: string | null;
  length?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
  dimensionUnit?: string | null;
  trackingNumber?: string | null;
  status?: string | null;
}

export interface ShipmentTrackingEvent {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  eventType: ShipmentTrackingEventType;
  eventTime: string;
  location?: string | null;
  description?: string | null;
  source?: string | null;
  externalReference?: string | null;
  createdAt: string;
}

export interface Shipment {
  id: string;
  organizationId: string;
  shipmentNumber: string;
  deliveryOrderId: string;
  salesOrderId: string;
  customerId: string;
  carrierId?: string | null;
  vehicleId?: string | null;
  status: ShipmentStatus;
  serviceType?: string | null;
  shipFromAddress?: string | null;
  shipToAddress?: string | null;
  plannedShipDate?: string | null;
  actualShipDate?: string | null;
  estimatedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  trackingNumber?: string | null;
  externalReference?: string | null;
  shippingCost: string | number;
  insuranceCost: string | number;
  otherCost: string | number;
  totalLogisticsCost: string | number;
  specialInstructions?: string | null;
  failureReason?: string | null;
  returnReason?: string | null;
  cancellationReason?: string | null;
  createdByUserId: string;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    code: string;
    name: string;
  };
  carrier?: ShipmentCarrier | null;
  deliveryOrder?: {
    id: string;
    deliveryNumber: string;
    status: string;
  };
  lines?: ShipmentLine[];
  packages?: ShipmentPackage[];
  trackingEvents?: ShipmentTrackingEvent[];
}

export interface ShipmentSummaryReport {
  totalShipments: number;
  draftCount: number;
  readyCount: number;
  assignedCount: number;
  dispatchedCount: number;
  inTransitCount: number;
  deliveredCount: number;
  failedCount: number;
  returnedCount: number;
  cancelledCount: number;
  closedCount: number;
  totalShippingCost: string;
  totalInsuranceCost: string;
  totalOtherCost: string;
  totalLogisticsCost: string;
  onTimeDeliveryRate: number;
}
