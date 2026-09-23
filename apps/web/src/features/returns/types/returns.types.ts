export type ReturnType =
  | "CUSTOMER_RETURN"
  | "SUPPLIER_RETURN"
  | "INTERNAL_RETURN"
  | "WARRANTY_RETURN"
  | "REPLACEMENT_RETURN";

export type ReturnStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "AUTHORIZED"
  | "AWAITING_RETURN"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "INSPECTION_REQUIRED"
  | "INSPECTING"
  | "DISPOSITION_PENDING"
  | "RESOLVED"
  | "CLOSED"
  | "REJECTED"
  | "CANCELLED"
  | "VOIDED";

export type ReturnLineStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "REJECTED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "INSPECTED"
  | "DISPOSITIONED"
  | "RESOLVED"
  | "CANCELLED";

export type ReturnDispositionType =
  | "RESTOCK"
  | "REPAIR"
  | "REWORK"
  | "REPLACE"
  | "SCRAP"
  | "RETURN_TO_SUPPLIER"
  | "REJECT_RETURN"
  | "NO_ACTION";

export type ReturnResolutionType =
  | "NONE"
  | "CREDIT_NOTE"
  | "REFUND"
  | "DEBIT_NOTE"
  | "REPLACEMENT"
  | "PARTIAL_CREDIT"
  | "PARTIAL_REFUND";

export interface ReturnReason {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  requiresInspection: boolean;
  defaultDisposition: ReturnDispositionType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnPolicy {
  id: string;
  organizationId: string;
  returnWindowDays: number;
  requireOriginalShipment: boolean;
  requireOriginalInvoice: boolean;
  allowPartialReturns: boolean;
  requireInspection: boolean;
  autoQuarantine: boolean;
  maxReplacementQty: string | number;
  allowRestocking: boolean;
  autoCreateCreditNote: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRequestLine {
  id: string;
  organizationId: string;
  returnRequestId: string;
  itemId: string;
  variantId?: string | null;
  sourceLineId?: string | null;
  requestedQuantity: string | number;
  authorizedQuantity: string | number;
  shippedReturnQuantity: string | number;
  receivedQuantity: string | number;
  inspectedQuantity: string | number;
  acceptedQuantity: string | number;
  rejectedQuantity: string | number;
  replacementQuantity: string | number;
  financialResolutionQuantity: string | number;
  unitPrice: string | number;
  taxAmount: string | number;
  lineAmount: string | number;
  reasonId?: string | null;
  status: ReturnLineStatus;
  createdAt: string;
  updatedAt: string;
  item?: { id: string; name: string; sku: string };
  variant?: { id: string; sku: string; name?: string | null } | null;
  reason?: ReturnReason | null;
}

export interface ReturnDispositionRecord {
  id: string;
  organizationId: string;
  returnRequestId: string;
  returnLineId: string;
  dispositionType: ReturnDispositionType;
  quantity: string | number;
  warehouseId: string;
  locationId: string;
  inspectionLotId?: string | null;
  referenceNotes?: string | null;
  processedByUserId: string;
  processedAt: string;
  createdAt: string;
  updatedAt: string;
  returnLine?: ReturnRequestLine;
  warehouse?: { id: string; name: string; code: string };
  location?: { id: string; name: string; code: string };
}

export interface ReturnResolution {
  id: string;
  organizationId: string;
  returnRequestId: string;
  returnLineId?: string | null;
  resolutionType: ReturnResolutionType;
  amount: string | number;
  quantity: string | number;
  customerCreditNoteId?: string | null;
  customerRefundId?: string | null;
  supplierDebitNoteId?: string | null;
  replacementSalesOrderId?: string | null;
  replacementReference?: string | null;
  notes?: string | null;
  processedByUserId: string;
  processedAt: string;
  createdAt: string;
  updatedAt: string;
  customerCreditNote?: { id: string; creditNoteNumber: string; grandTotal: string | number };
  customerRefund?: { id: string; refundNumber: string; amount: string | number };
  supplierDebitNote?: { id: string; debitNoteNumber: string; grandTotal: string | number };
  replacementSalesOrder?: { id: string; orderNumber: string };
}

export interface ReturnRequest {
  id: string;
  organizationId: string;
  returnNumber: string;
  returnType: ReturnType;
  status: ReturnStatus;
  customerId?: string | null;
  supplierId?: string | null;
  salesOrderId?: string | null;
  deliveryOrderId?: string | null;
  shipmentId?: string | null;
  reverseShipmentId?: string | null;
  customerInvoiceId?: string | null;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  supplierInvoiceId?: string | null;
  inspectionLotId?: string | null;
  reasonId: string;
  requestedAt: string;
  authorizedAt?: string | null;
  authorizedByUserId?: string | null;
  receivedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  isImmutable: boolean;
  notes?: string | null;
  authorizationNotes?: string | null;
  rejectionReason?: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; code: string } | null;
  supplier?: { id: string; name: string; code: string } | null;
  salesOrder?: { id: string; orderNumber: string } | null;
  deliveryOrder?: { id: string; deliveryNumber: string } | null;
  shipment?: { id: string; shipmentNumber: string } | null;
  reverseShipment?: { id: string; shipmentNumber: string; trackingNumber?: string | null } | null;
  customerInvoice?: { id: string; invoiceNumber: string } | null;
  purchaseOrder?: { id: string; poNumber: string } | null;
  goodsReceipt?: { id: string; receiptNumber: string } | null;
  supplierInvoice?: { id: string; invoiceNumber: string } | null;
  inspectionLot?: {
    id: string;
    lotNumber: string;
    status: string;
    decision?: string | null;
  } | null;
  reason: ReturnReason;
  lines: ReturnRequestLine[];
  dispositions: ReturnDispositionRecord[];
  resolutions: ReturnResolution[];
}
