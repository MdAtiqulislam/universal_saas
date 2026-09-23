export type DataOperationType = "EXPORT" | "IMPORT";

export type DataOperationStatus =
  | "PENDING"
  | "PREVIEWING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "PARTIALLY_COMPLETED";

export type DataImportMode = "CREATE_ONLY" | "UPDATE_ONLY" | "UPSERT";

export type DataDuplicateStrategy = "FAIL" | "SKIP" | "UPDATE";

export interface FieldSchemaDefinition {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  isRestricted?: boolean;
  allowedValues?: string[];
  description?: string;
  defaultValue?: unknown;
}

export interface DataOperationDefinition {
  operationKey: string;
  domain: string;
  entity: string;
  operationType: DataOperationType;
  allowedFormats: ("CSV" | "JSON")[];
  requiredPermissions: string[];
  restrictedFieldPermissions: Record<string, string>;
  fieldSchema: FieldSchemaDefinition[];
  maxRows: number;
  maxFileSize: number;
  maxColumns: number;
  supportedModes: DataImportMode[];
}

export interface DataOperationJob {
  id: string;
  organizationId: string;
  operationKey: string;
  operationType: DataOperationType;
  status: DataOperationStatus;
  format: string;
  mode?: DataImportMode;
  dryRun: boolean;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  fileName?: string;
  fileSize?: number;
  errorSummary?: string;
  completedBatches: number[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface ImportPreviewResult {
  jobId: string;
  operationKey: string;
  mode: DataImportMode;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  plannedCreates: number;
  plannedUpdates: number;
  plannedSkips: number;
  errors: {
    rowNumber: number;
    fieldName?: string;
    errorCode: string;
    errorMessage: string;
  }[];
  warnings: string[];
  previewRows: Record<string, unknown>[];
}

export interface ExportResult {
  jobId: string;
  operationKey: string;
  format: "CSV" | "JSON";
  rowCount: number;
  fileContent: string;
  fileName: string;
  fileSizeBytes: number;
  durationMs: number;
}
