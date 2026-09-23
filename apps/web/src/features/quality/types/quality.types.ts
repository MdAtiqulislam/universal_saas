export type InspectionType =
  | "INCOMING_PURCHASE"
  | "GOODS_RECEIPT"
  | "IN_PROCESS_MANUFACTURING"
  | "FINISHED_GOODS"
  | "OUTGOING_SHIPMENT"
  | "CUSTOMER_RETURN"
  | "INTERNAL_AUDIT"
  | "PERIODIC_STOCK_CHECK";

export type InspectionLotStatus =
  "DRAFT" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DECIDED" | "CANCELLED";

export type InspectionDecision =
  | "ACCEPT"
  | "ACCEPT_WITH_DEVIATION"
  | "REWORK"
  | "REJECT"
  | "SCRAP"
  | "RETURN_TO_SUPPLIER"
  | "HOLD";

export type SamplingType =
  "FULL_100_PERCENT" | "FIXED_QUANTITY" | "PERCENTAGE_BASED" | "LOT_SIZE_BASED";

export type CharacteristicDataType = "NUMERIC_VALUE" | "QUALITATIVE_PASS_FAIL" | "TEXT_OBSERVATION";

export type QualityHoldStatus = "ACTIVE" | "RELEASED" | "DISPOSITIONED" | "SCRAPPED" | "RETURNED";

export type NonConformanceSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type NonConformanceStatus =
  | "OPEN"
  | "CONTAINED"
  | "INVESTIGATING"
  | "ROOT_CAUSE_IDENTIFIED"
  | "DISPOSITIONED"
  | "CAPA_REQUIRED"
  | "CLOSED"
  | "CANCELLED";

export type CapaStatus =
  "DRAFT" | "OPEN" | "IN_PROGRESS" | "PENDING_VERIFICATION" | "VERIFIED" | "CLOSED" | "CANCELLED";

export type QualityIssueStatus = "REPORTED" | "INVESTIGATING" | "RESOLVED" | "REJECTED" | "CLOSED";

export interface QualityConfiguration {
  id: string;
  organizationId: string;
  defaultInspectionType: InspectionType;
  autoCreateIncomingLots: boolean;
  autoCreateFinishedGoodsLots: boolean;
  autoCreateOutgoingLots: boolean;
  holdOnFailure: boolean;
  requireAllMandatoryCharacteristics: boolean;
  defaultSamplingPlanId?: string | null;
  defaultSamplingPlan?: SamplingPlan | null;
}

export interface SamplingPlan {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  samplingType: SamplingType;
  fixedSampleQuantity?: number | string | null;
  percentageRate?: number | string | null;
  lotRangesJson?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    inspectionPlans: number;
  };
}

export interface InspectionCharacteristic {
  id: string;
  inspectionPlanId: string;
  sequence: number;
  code: string;
  name: string;
  description?: string | null;
  dataType: CharacteristicDataType;
  unitOfMeasure?: string | null;
  targetValue?: number | string | null;
  minSpec?: number | string | null;
  maxSpec?: number | string | null;
  tolerance?: number | string | null;
  isMandatory: boolean;
  acceptanceCriteria?: string | null;
}

export interface InspectionPlan {
  id: string;
  organizationId: string;
  planNumber: string;
  name: string;
  version: number;
  description?: string | null;
  itemId: string;
  variantId?: string | null;
  inspectionType: InspectionType;
  samplingPlanId?: string | null;
  isActive: boolean;
  isImmutable: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  item?: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string; name: string };
  samplingPlan?: SamplingPlan | null;
  characteristics: InspectionCharacteristic[];
  _count?: {
    inspectionLots: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InspectionResult {
  id: string;
  organizationId: string;
  inspectionLotId: string;
  characteristicId: string;
  sampleNumber: number;
  observedNumericValue?: number | string | null;
  observedTextValue?: string | null;
  isPass: boolean;
  inspectorUserId?: string | null;
  isImmutable: boolean;
  notes?: string | null;
  characteristic?: InspectionCharacteristic;
  recordedAt: string;
}

export interface QualityInspectionLot {
  id: string;
  organizationId: string;
  lotNumber: string;
  inspectionPlanId?: string | null;
  itemId: string;
  variantId?: string | null;
  warehouseId: string;
  locationId: string;
  batchId?: string | null;
  serialId?: string | null;
  inspectionType: InspectionType;
  totalQuantity: number | string;
  sampleQuantity: number | string;
  inspectedQuantity: number | string;
  passedQuantity: number | string;
  failedQuantity: number | string;
  status: InspectionLotStatus;
  decision?: InspectionDecision | null;
  decisionNotes?: string | null;
  decidedByUserId?: string | null;
  decidedAt?: string | null;
  isImmutable: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  item?: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string; name: string };
  warehouse?: { id: string; code: string; name: string };
  location?: { id: string; code: string; name: string };
  supplier?: { id: string; code: string; name: string };
  customer?: { id: string; code: string; name: string };
  inspectionPlan?: InspectionPlan | null;
  results?: InspectionResult[];
  holds?: QualityHold[];
  nonConformances?: NonConformance[];
}

export interface QualityHold {
  id: string;
  organizationId: string;
  holdNumber: string;
  inspectionLotId?: string | null;
  itemId: string;
  variantId?: string | null;
  warehouseId: string;
  locationId: string;
  batchId?: string | null;
  serialId?: string | null;
  holdQuantity: number | string;
  status: QualityHoldStatus;
  reason: string;
  notes?: string | null;
  releaseNotes?: string | null;
  releasedAt?: string | null;
  releasedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  item?: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string; name: string };
  warehouse?: { id: string; code: string; name: string };
  location?: { id: string; code: string; name: string };
  inspectionLot?: { id: string; lotNumber: string };
}

export interface NonConformance {
  id: string;
  organizationId: string;
  ncrNumber: string;
  title: string;
  description: string;
  sourceInspectionLotId?: string | null;
  itemId: string;
  variantId?: string | null;
  batchId?: string | null;
  serialId?: string | null;
  supplierId?: string | null;
  customerId?: string | null;
  productionOrderId?: string | null;
  quantityAffected: number | string;
  severity: NonConformanceSeverity;
  status: NonConformanceStatus;
  containmentAction?: string | null;
  rootCause?: string | null;
  disposition?: string | null;
  dispositionNotes?: string | null;
  ownerUserId?: string | null;
  closedAt?: string | null;
  closedByUserId?: string | null;
  targetDate?: string | null;
  createdAt: string;
  updatedAt: string;
  item?: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string; name: string };
  supplier?: { id: string; code: string; name: string };
  customer?: { id: string; code: string; name: string };
  sourceInspectionLot?: { id: string; lotNumber: string };
  capas?: CAPA[];
  customerIssues?: CustomerQualityIssue[];
}

export interface CAPA {
  id: string;
  organizationId: string;
  capaNumber: string;
  title: string;
  description: string;
  nonConformanceId?: string | null;
  sourceInspectionLotId?: string | null;
  rootCauseAnalysis?: string | null;
  correctiveAction?: string | null;
  preventiveAction?: string | null;
  status: CapaStatus;
  ownerUserId?: string | null;
  verifiedByUserId?: string | null;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
  effectivenessReview?: string | null;
  closedAt?: string | null;
  closedByUserId?: string | null;
  targetDate?: string | null;
  createdAt: string;
  updatedAt: string;
  nonConformance?: {
    id: string;
    ncrNumber: string;
    title: string;
    severity: NonConformanceSeverity;
  };
  sourceInspectionLot?: { id: string; lotNumber: string };
}

export interface CustomerQualityIssue {
  id: string;
  organizationId: string;
  issueNumber: string;
  customerId: string;
  salesOrderId?: string | null;
  shipmentId?: string | null;
  itemId: string;
  variantId?: string | null;
  batchId?: string | null;
  serialId?: string | null;
  issueDescription: string;
  severity: NonConformanceSeverity;
  status: QualityIssueStatus;
  nonConformanceId?: string | null;
  reportedAt: string;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  customer?: { id: string; code: string; name: string };
  item?: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string; name: string };
  salesOrder?: { id: string; orderNumber: string };
  shipment?: { id: string; shipmentNumber: string };
  nonConformance?: { id: string; ncrNumber: string; status: NonConformanceStatus };
}

export interface SupplierQualitySummaryItem {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  totalLots: number;
  acceptedLots: number;
  rejectedLots: number;
  lotRejectionRate: number;
  totalInspectedQty: number;
  totalFailedQty: number;
  defectRate: number;
  ncrCount: number;
  returnCount: number;
  qualityScore: number;
}
