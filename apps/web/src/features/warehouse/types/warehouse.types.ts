export type WarehouseLocationType =
  | "STORAGE"
  | "RECEIVING"
  | "PICKING"
  | "PACKING"
  | "QUARANTINE"
  | "DAMAGED"
  | "RETURN"
  | "SCRAP"
  | "PRODUCTION"
  | "STAGING"
  | "TRANSIT";

export type WarehouseTaskType = "PUTAWAY" | "PICK" | "TRANSFER" | "COUNT" | "REPLENISHMENT";

export type WarehouseTaskStatus =
  "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type PickTaskStatus =
  "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "PARTIALLY_PICKED" | "PICKED" | "CANCELLED";

export type PickWaveStatus = "DRAFT" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type WarehouseTransferStatus =
  "DRAFT" | "SUBMITTED" | "APPROVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "REJECTED";

export type CycleCountStatus =
  "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COUNTED" | "REVIEWED" | "POSTED" | "CANCELLED";

export type QuarantineStatus =
  "QUARANTINED" | "UNDER_INSPECTION" | "RELEASED" | "HELD" | "SCRAPPED" | "RETURNED";

export type ReplenishmentStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface WarehouseZone {
  id: string;
  organizationId: string;
  locationId: string;
  code: string;
  name: string;
  zoneType: string;
  description?: string | null;
  isActive: boolean;
  location?: { id: string; code: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseStockPosition {
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  variantId: string | null;
  variantSku: string | null;
  onHand: string;
  reserved: string;
  available: string;
  quarantined: string;
  damaged: string;
  staged: string;
}

export interface WarehouseTask {
  id: string;
  organizationId: string;
  taskNumber: string;
  taskType: WarehouseTaskType;
  priority: number;
  status: WarehouseTaskStatus;
  warehouseId: string;
  sourceLocationId?: string | null;
  targetLocationId?: string | null;
  assignedUserId?: string | null;
  completedByUserId?: string | null;
  sourceDocumentType?: string | null;
  sourceDocumentId?: string | null;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  warehouse?: { id: string; code: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface PutawayTaskLine {
  id: string;
  putawayTaskId: string;
  itemId: string;
  variantId?: string | null;
  batchId?: string | null;
  serialId?: string | null;
  suggestedLocationId?: string | null;
  actualLocationId?: string | null;
  quantity: string;
  status: WarehouseTaskStatus;
  item: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string } | null;
  batch?: { id: string; batchNumber: string } | null;
  serial?: { id: string; serialNumber: string } | null;
}

export interface PutawayTask {
  id: string;
  organizationId: string;
  taskNumber: string;
  warehouseId: string;
  sourceLocationId: string;
  targetLocationId?: string | null;
  sourceDocumentType?: string | null;
  sourceDocumentId?: string | null;
  status: WarehouseTaskStatus;
  priority: number;
  assignedUserId?: string | null;
  completedByUserId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  warehouse: { id: string; code: string; name: string };
  sourceLocation: { id: string; code: string; name: string };
  targetLocation?: { id: string; code: string; name: string } | null;
  lines: PutawayTaskLine[];
  createdAt: string;
  updatedAt: string;
}

export interface PickTaskLine {
  id: string;
  pickTaskId: string;
  salesOrderLineId?: string | null;
  deliveryOrderLineId?: string | null;
  reservationId?: string | null;
  itemId: string;
  variantId?: string | null;
  sourceLocationId: string;
  requestedQuantity: string;
  pickedQuantity: string;
  batchId?: string | null;
  serialId?: string | null;
  status: PickTaskStatus;
  item: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string } | null;
  sourceLocation: { id: string; code: string; name: string };
  batch?: { id: string; batchNumber: string } | null;
  serial?: { id: string; serialNumber: string } | null;
}

export interface PickTask {
  id: string;
  organizationId: string;
  taskNumber: string;
  warehouseId: string;
  salesOrderId?: string | null;
  deliveryOrderId?: string | null;
  stagingLocationId?: string | null;
  waveId?: string | null;
  status: PickTaskStatus;
  priority: number;
  assignedUserId?: string | null;
  completedByUserId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  warehouse: { id: string; code: string; name: string };
  salesOrder?: { id: string; orderNumber: string } | null;
  deliveryOrder?: { id: string; deliveryNumber: string } | null;
  stagingLocation?: { id: string; code: string; name: string } | null;
  lines: PickTaskLine[];
  createdAt: string;
  updatedAt: string;
}

export interface PickWave {
  id: string;
  organizationId: string;
  waveNumber: string;
  warehouseId: string;
  status: PickWaveStatus;
  description?: string | null;
  releasedAt?: string | null;
  completedAt?: string | null;
  warehouse: { id: string; code: string; name: string };
  pickTasks?: Array<{
    id: string;
    taskNumber: string;
    status: PickTaskStatus;
    priority: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseTransferLine {
  id: string;
  transferId: string;
  itemId: string;
  variantId?: string | null;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: string;
  batchId?: string | null;
  serialId?: string | null;
  item: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string } | null;
  sourceLocation: { id: string; code: string; name: string };
  destinationLocation: { id: string; code: string; name: string };
  batch?: { id: string; batchNumber: string } | null;
  serial?: { id: string; serialNumber: string } | null;
}

export interface WarehouseTransfer {
  id: string;
  organizationId: string;
  transferNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  status: WarehouseTransferStatus;
  reason?: string | null;
  submittedByUserId?: string | null;
  approvedByUserId?: string | null;
  completedByUserId?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  sourceWarehouse: { id: string; code: string; name: string };
  destinationWarehouse: { id: string; code: string; name: string };
  lines: WarehouseTransferLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CycleCountLine {
  id: string;
  cycleCountId: string;
  locationId: string;
  itemId: string;
  variantId?: string | null;
  batchId?: string | null;
  serialId?: string | null;
  systemQuantity: string;
  countedQuantity?: string | null;
  varianceQuantity?: string | null;
  varianceValue?: string | null;
  recountQuantity?: string | null;
  notes?: string | null;
  location: { id: string; code: string; name: string };
  item: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string } | null;
  batch?: { id: string; batchNumber: string } | null;
  serial?: { id: string; serialNumber: string } | null;
}

export interface CycleCount {
  id: string;
  organizationId: string;
  countNumber: string;
  warehouseId: string;
  zoneId?: string | null;
  status: CycleCountStatus;
  isBlind: boolean;
  description?: string | null;
  assignedCounterUserId?: string | null;
  reviewedByUserId?: string | null;
  postedByUserId?: string | null;
  scheduledDate?: string | null;
  countedAt?: string | null;
  reviewedAt?: string | null;
  postedAt?: string | null;
  warehouse: { id: string; code: string; name: string };
  zone?: { id: string; code: string; name: string } | null;
  lines: CycleCountLine[];
  createdAt: string;
  updatedAt: string;
}

export interface ReplenishmentRule {
  id: string;
  organizationId: string;
  warehouseId: string;
  itemId: string;
  variantId?: string | null;
  sourceLocationId: string;
  destinationLocationId: string;
  minQuantity: string;
  maxQuantity: string;
  replenishQuantity: string;
  isActive: boolean;
  warehouse: { id: string; code: string; name: string };
  item: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string } | null;
  sourceLocation: { id: string; code: string; name: string };
  destinationLocation: { id: string; code: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface ReplenishmentTask {
  id: string;
  organizationId: string;
  taskNumber: string;
  ruleId?: string | null;
  warehouseId: string;
  itemId: string;
  variantId?: string | null;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: string;
  status: ReplenishmentStatus;
  assignedUserId?: string | null;
  completedByUserId?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  warehouse: { id: string; code: string; name: string };
  item: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string } | null;
  sourceLocation: { id: string; code: string; name: string };
  destinationLocation: { id: string; code: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface QuarantineRecord {
  id: string;
  organizationId: string;
  quarantineNumber: string;
  warehouseId: string;
  locationId: string;
  itemId: string;
  variantId?: string | null;
  batchId?: string | null;
  serialId?: string | null;
  quantity: string;
  status: QuarantineStatus;
  reason: string;
  sourceDocumentType?: string | null;
  sourceDocumentId?: string | null;
  disposition?: string | null;
  dispositionNotes?: string | null;
  inspectedByUserId?: string | null;
  inspectedAt?: string | null;
  releasedByUserId?: string | null;
  releasedAt?: string | null;
  warehouse: { id: string; code: string; name: string };
  location: { id: string; code: string; name: string };
  item: { id: string; sku: string; name: string };
  variant?: { id: string; sku: string } | null;
  batch?: { id: string; batchNumber: string } | null;
  serial?: { id: string; serialNumber: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseConfiguration {
  id: string;
  organizationId: string;
  defaultReceivingLocationId?: string | null;
  defaultStagingLocationId?: string | null;
  defaultQuarantineLocationId?: string | null;
  defaultScrapLocationId?: string | null;
  defaultReturnLocationId?: string | null;
  defaultPickLocationId?: string | null;
  defaultReceivingLocation?: { id: string; code: string; name: string } | null;
  defaultStagingLocation?: { id: string; code: string; name: string } | null;
  defaultQuarantineLocation?: { id: string; code: string; name: string } | null;
  defaultScrapLocation?: { id: string; code: string; name: string } | null;
  defaultReturnLocation?: { id: string; code: string; name: string } | null;
  defaultPickLocation?: { id: string; code: string; name: string } | null;
}
