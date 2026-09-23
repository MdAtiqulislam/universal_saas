export type WorkflowStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type WorkflowVersionStatus = "DRAFT" | "PUBLISHED" | "RETIRED";
export type WorkflowNodeType =
  | "START"
  | "END"
  | "CONDITION"
  | "ACTION"
  | "APPROVAL"
  | "PARALLEL"
  | "JOIN"
  | "DELAY"
  | "SCHEDULE"
  | "SUB_WORKFLOW";

export type WorkflowTriggerType = "INTEGRATION_EVENT" | "SCHEDULE" | "MANUAL" | "API";

export type WorkflowExecutionStatus =
  "PENDING" | "RUNNING" | "WAITING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";

export type WorkflowStepStatus =
  "PENDING" | "RUNNING" | "SUCCESS" | "COMPLETED" | "FAILED" | "SKIPPED" | "WAITING";

export type WorkflowApprovalStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "DELEGATED" | "ESCALATED";

export type WorkflowApprovalType =
  "SINGLE_APPROVER" | "ALL_MUST_APPROVE" | "ANY_ONE_APPROVES" | "QUORUM";

export type WorkflowScheduleType = "CRON" | "INTERVAL";
export type WorkflowScheduleStatus = "ACTIVE" | "PAUSED" | "DISABLED";

export interface WorkflowDefinition {
  id: string;
  key: string;
  name: string;
  description?: string;
  category: string;
  status: WorkflowStatus;
  activeVersionId?: string;
  createdAt: string;
  updatedAt: string;
  activeVersion?: WorkflowVersion;
  _count?: {
    versions: number;
    executions: number;
    triggers: number;
  };
}

export interface WorkflowNode {
  id: string;
  nodeKey: string;
  name: string;
  nodeType: WorkflowNodeType;
  actionType?: string;
  ruleConfig?: Record<string, unknown>;
  actionConfig?: Record<string, unknown>;
  approvalConfig?: Record<string, unknown>;
  delayConfig?: Record<string, unknown>;
  positionX?: number;
  positionY?: number;
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  conditionValue?: string;
  isDefault: boolean;
}

export interface WorkflowVersion {
  id: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  description?: string;
  checksum: string;
  publishedAt?: string;
  retiredAt?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
}

export interface WorkflowTrigger {
  id: string;
  triggerType: WorkflowTriggerType;
  eventType?: string;
  filterRules?: Record<string, unknown>;
  isEnabled: boolean;
  scheduleConfig?: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  workflowDefinitionId: string;
  workflowVersionId: string;
  status: WorkflowExecutionStatus;
  triggerType: WorkflowTriggerType;
  inputContext: Record<string, unknown>;
  outputContext?: Record<string, unknown>;
  currentNodeId?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  definition?: Pick<WorkflowDefinition, "id" | "name" | "key">;
  steps?: WorkflowExecutionStep[];
  approvals?: WorkflowApproval[];
}

export interface WorkflowExecutionStep {
  id: string;
  nodeId: string;
  nodeKey: string;
  nodeType: WorkflowNodeType;
  actionType?: string;
  status: WorkflowStepStatus;
  stepNumber: number;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface WorkflowApproval {
  id: string;
  workflowExecutionId: string;
  nodeId: string;
  status: WorkflowApprovalStatus;
  approvalType: WorkflowApprovalType;
  requiredCount: number;
  approvalCount: number;
  rejectionCount: number;
  requestedAt: string;
  respondedAt?: string;
  expiresAt?: string;
  escalationAt?: string;
  execution?: Pick<WorkflowExecution, "id"> & {
    definition?: Pick<WorkflowDefinition, "name" | "key">;
  };
  actions?: WorkflowApprovalAction[];
}

export interface WorkflowApprovalAction {
  id: string;
  userId: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string;
  createdAt: string;
}

export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  scheduleType: WorkflowScheduleType;
  cronExpression?: string;
  intervalSeconds?: number;
  timezone: string;
  status: WorkflowScheduleStatus;
  lastExecutedAt?: string;
  nextRunAt?: string;
  failureCount: number;
  runCount: number;
  workflow?: Pick<WorkflowDefinition, "id" | "name" | "key">;
}

export interface WorkflowRuleAst {
  field?: string;
  operator: string;
  value?: unknown;
  operands?: WorkflowRuleAst[];
}

export interface WorkflowOverviewReport {
  totalDefinitions: number;
  activeDefinitions: number;
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  waitingExecutions: number;
  successRate: number;
  pendingApprovals: number;
  activeSchedules: number;
}
