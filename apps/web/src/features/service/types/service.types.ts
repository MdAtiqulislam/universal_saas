export type WarrantyStatus = "ACTIVE" | "EXPIRED" | "VOIDED" | "NOT_APPLICABLE";
export type WarrantyCoverageType = "FULL" | "PARTS_ONLY" | "LABOR_ONLY" | "LIMITED" | "NONE";
export type CustomerAssetServiceStatus =
  "OPERATIONAL" | "UNDER_SERVICE" | "DECOMMISSIONED" | "SCRAPPED";
export type ServiceRequestType =
  | "REPAIR"
  | "MAINTENANCE"
  | "INSTALLATION"
  | "WARRANTY_CLAIM"
  | "INSPECTION"
  | "CONFIGURATION"
  | "TRAINING"
  | "OTHER";
export type ServiceRequestStatus =
  "DRAFT" | "SUBMITTED" | "TRIAGED" | "CONVERTED_TO_TICKET" | "CANCELLED" | "REJECTED";
export type ServicePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT" | "CRITICAL";
export type ServiceTicketStatus =
  | "OPEN"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_DIAGNOSIS"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "IN_SERVICE"
  | "QUALITY_CHECK"
  | "COMPLETED"
  | "HANDED_OVER"
  | "CLOSED"
  | "ON_HOLD"
  | "CANCELLED";
export type ServiceSlaStatus = "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET";
export type ServiceEstimateStatus =
  "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export type ServiceLineType = "PART" | "LABOR" | "SERVICE_FEE" | "TRAVEL" | "OTHER";
export type ServiceOrderStatus =
  | "DRAFT"
  | "RELEASED"
  | "IN_PROGRESS"
  | "PARTIALLY_COMPLETED"
  | "QUALITY_CHECK"
  | "COMPLETED"
  | "HANDED_OVER"
  | "CLOSED"
  | "ON_HOLD"
  | "CANCELLED";

export interface CustomerAsset {
  id: string;
  organizationId: string;
  assetNumber: string;
  customerId: string;
  itemId: string;
  variantId?: string | null;
  serialId?: string | null;
  serialNumber?: string | null;
  installationDate?: string | null;
  purchaseDate: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  warrantyStatus: WarrantyStatus;
  serviceStatus: CustomerAssetServiceStatus;
  locationAddress?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; code: string };
  item?: { id: string; name: string; sku: string };
  variant?: { id: string; name: string; sku: string } | null;
  warranties?: CustomerAssetWarranty[];
  serviceRequests?: ServiceRequest[];
  serviceTickets?: ServiceTicket[];
  serviceOrders?: ServiceOrder[];
}

export interface WarrantyPolicy {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  durationMonths: number;
  coverageType: WarrantyCoverageType;
  laborCovered: boolean;
  partsCovered: boolean;
  replacementCovered: boolean;
  inspectionRequired: boolean;
  exclusions?: any;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
}

export interface CustomerAssetWarranty {
  id: string;
  customerAssetId: string;
  warrantyPolicyId: string;
  startDate: string;
  endDate: string;
  status: WarrantyStatus;
  claimLimitAmount?: number | string | null;
  claimedAmount?: number | string;
  notes?: string | null;
  warrantyPolicy?: WarrantyPolicy;
}

export interface ServiceRequest {
  id: string;
  organizationId: string;
  requestNumber: string;
  customerId: string;
  customerAssetId?: string | null;
  itemId: string;
  variantId?: string | null;
  serialNumber?: string | null;
  requestType: ServiceRequestType;
  priority: ServicePriority;
  issueCategory: string;
  subject: string;
  description: string;
  sourceRmaId?: string | null;
  status: ServiceRequestStatus;
  requestedAt: string;
  preferredServiceDate?: string | null;
  triagedAt?: string | null;
  triageNotes?: string | null;
  customer?: { id: string; name: string; code: string };
  customerAsset?: CustomerAsset | null;
  item?: { id: string; name: string; sku: string };
  tickets?: ServiceTicket[];
}

export interface ServiceTicket {
  id: string;
  organizationId: string;
  ticketNumber: string;
  serviceRequestId?: string | null;
  customerId: string;
  customerAssetId?: string | null;
  itemId: string;
  variantId?: string | null;
  priority: ServicePriority;
  status: ServiceTicketStatus;
  slaStatus: ServiceSlaStatus;
  openedAt: string;
  firstResponseDueAt?: string | null;
  firstResponseAt?: string | null;
  resolutionDueAt?: string | null;
  resolvedAt?: string | null;
  assignedTechnicianId?: string | null;
  assignedAt?: string | null;
  subject: string;
  description: string;
  customer?: { id: string; name: string; code: string };
  customerAsset?: CustomerAsset | null;
  item?: { id: string; name: string; sku: string };
  assignedTechnician?: { id: string; firstName: string; lastName: string } | null;
  diagnoses?: ServiceDiagnosis[];
  estimates?: ServiceEstimate[];
  serviceOrders?: ServiceOrder[];
}

export interface ServiceDiagnosis {
  id: string;
  serviceTicketId: string;
  technicianId: string;
  diagnosedAt: string;
  diagnosisCode: string;
  symptoms: string;
  rootCause: string;
  repairRecommended: boolean;
  replacementRecommended: boolean;
  warrantyCovered: boolean;
  notes?: string | null;
  isFinalized: boolean;
  finalizedAt?: string | null;
  technician?: { id: string; firstName: string; lastName: string };
}

export interface ServiceEstimateLine {
  id: string;
  lineType: ServiceLineType;
  itemId?: string | null;
  description: string;
  quantity: number | string;
  unitRate: number | string;
  discountAmount: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  warrantyCovered: boolean;
  item?: { id: string; name: string; sku: string } | null;
}

export interface ServiceEstimate {
  id: string;
  estimateNumber: string;
  serviceTicketId: string;
  customerId: string;
  customerAssetId?: string | null;
  status: ServiceEstimateStatus;
  subtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  warrantyCoveredAmount: number | string;
  customerPayableAmount: number | string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  lines: ServiceEstimateLine[];
  customer?: { id: string; name: string; code: string };
  customerAsset?: CustomerAsset | null;
}

export interface ServicePartRequirement {
  id: string;
  serviceOrderId: string;
  itemId: string;
  variantId?: string | null;
  requiredQuantity: number | string;
  reservedQuantity: number | string;
  issuedQuantity: number | string;
  returnedQuantity: number | string;
  unitCost: number | string;
  unitPrice: number | string;
  warrantyCovered: boolean;
  item: { id: string; name: string; sku: string };
}

export interface ServiceLaborEntry {
  id: string;
  serviceOrderId: string;
  employeeId: string;
  workDate: string;
  billableHours: number | string;
  actualHours: number | string;
  laborRate: number | string;
  internalCostRate: number | string;
  laborCost: number | string;
  laborCharge: number | string;
  warrantyCovered: boolean;
  description: string;
  isFinalized: boolean;
  employee: { id: string; firstName: string; lastName: string };
}

export interface ServiceHandover {
  id: string;
  serviceOrderId: string;
  handoverDate: string;
  recipientName: string;
  recipientContact?: string | null;
  acceptanceNotes?: string | null;
  deliveryReference?: string | null;
}

export interface ServiceOrder {
  id: string;
  organizationId: string;
  serviceOrderNumber: string;
  serviceTicketId?: string | null;
  customerId: string;
  customerAssetId?: string | null;
  serviceLocationId?: string | null;
  assignedTechnicianId?: string | null;
  status: ServiceOrderStatus;
  warrantyStatus: WarrantyStatus;
  estimateId?: string | null;
  customerInvoiceId?: string | null;
  sourceRmaId?: string | null;
  inspectionLotId?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  partsCost: number | string;
  laborCost: number | string;
  otherCost: number | string;
  totalCost: number | string;
  warrantyCost: number | string;
  customerCharge: number | string;
  createdAt: string;
  customer?: { id: string; name: string; code: string };
  customerAsset?: CustomerAsset | null;
  assignedTechnician?: { id: string; firstName: string; lastName: string } | null;
  customerInvoice?: { id: string; invoiceNumber: string; grandTotal: number | string } | null;
  partsRequirements?: ServicePartRequirement[];
  laborEntries?: ServiceLaborEntry[];
  handovers?: ServiceHandover[];
}

export interface ServiceSummaryReport {
  tickets: {
    total: number;
    open: number;
    completed: number;
    breached: number;
  };
  serviceOrders: {
    total: number;
    active: number;
    completed: number;
    warranty: number;
    chargeable: number;
  };
  installedBase: {
    totalCustomerAssets: number;
  };
}
