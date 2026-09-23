import {
  WorkflowDefinition,
  WorkflowVersion,
  WorkflowExecution,
  WorkflowApproval,
  WorkflowSchedule,
  WorkflowOverviewReport,
} from "../types";

const BASE = "/api/v1";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({ message: "Request failed" }))) as {
      message?: string;
    };
    throw new Error(error.message ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// Workflow Definitions
export const getWorkflows = (params?: { category?: string; status?: string }) =>
  apiFetch<WorkflowDefinition[]>(
    `/workflows${params ? "?" + new URLSearchParams(params as Record<string, string>) : ""}`,
  );

export const getWorkflow = (id: string) => apiFetch<WorkflowDefinition>(`/workflows/${id}`);

export const createWorkflow = (data: {
  key: string;
  name: string;
  description?: string;
  category?: string;
}) =>
  apiFetch<WorkflowDefinition>("/workflows", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateWorkflow = (
  id: string,
  data: { name?: string; description?: string; category?: string; status?: string },
) =>
  apiFetch<WorkflowDefinition>(`/workflows/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteWorkflow = (id: string) =>
  apiFetch<{ success: boolean }>(`/workflows/${id}`, { method: "DELETE" });

export const executeWorkflow = (
  id: string,
  data?: { inputContext?: Record<string, unknown>; clientIdempotencyKey?: string },
) =>
  apiFetch<WorkflowExecution>(`/workflows/${id}/execute`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });

// Versions
export const getWorkflowVersions = (workflowId: string) =>
  apiFetch<WorkflowVersion[]>(`/workflows/${workflowId}/versions`);

export const createWorkflowVersion = (
  workflowId: string,
  data: {
    description?: string;
    nodes: Array<{
      nodeKey: string;
      name: string;
      nodeType: string;
      actionType?: string;
      ruleConfig?: Record<string, unknown>;
      actionConfig?: Record<string, unknown>;
      approvalConfig?: Record<string, unknown>;
      delayConfig?: Record<string, unknown>;
      positionX?: number;
      positionY?: number;
    }>;
    edges: Array<{
      sourceNodeKey: string;
      targetNodeKey: string;
      conditionValue?: string;
      isDefault?: boolean;
    }>;
  },
) =>
  apiFetch<WorkflowVersion>(`/workflows/${workflowId}/versions`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const publishWorkflowVersion = (workflowId: string, versionId: string) =>
  apiFetch<WorkflowVersion>(`/workflows/${workflowId}/versions/${versionId}/publish`, {
    method: "POST",
  });

// Executions
export const getExecutions = (params?: {
  workflowDefinitionId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) =>
  apiFetch<{
    executions: WorkflowExecution[];
    total: number;
    page: number;
    totalPages: number;
  }>(
    `/workflow-executions${
      params ? "?" + new URLSearchParams(params as Record<string, string>) : ""
    }`,
  );

export const getExecution = (id: string) =>
  apiFetch<WorkflowExecution>(`/workflow-executions/${id}`);

export const cancelExecution = (id: string) =>
  apiFetch<WorkflowExecution>(`/workflow-executions/${id}/cancel`, {
    method: "POST",
  });

export const retryExecution = (id: string, reason?: string) =>
  apiFetch<WorkflowExecution>(`/workflow-executions/${id}/retry`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

// Approvals
export const getPendingApprovals = () =>
  apiFetch<WorkflowApproval[]>("/workflow-approvals/pending");

export const decideApproval = (
  approvalId: string,
  data: { decision: "APPROVED" | "REJECTED"; comment?: string },
) =>
  apiFetch<WorkflowApproval>(`/workflow-approvals/${approvalId}/decide`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const delegateApproval = (
  approvalId: string,
  data: { delegateToUserId: string; reason?: string },
) =>
  apiFetch<WorkflowApproval>(`/workflow-approvals/${approvalId}/delegate`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// Schedules
export const getSchedules = () => apiFetch<WorkflowSchedule[]>("/workflow-schedules");

export const createSchedule = (data: {
  workflowId: string;
  scheduleType: "CRON" | "INTERVAL";
  cronExpression?: string;
  intervalSeconds?: number;
  timezone?: string;
}) =>
  apiFetch<WorkflowSchedule>("/workflow-schedules", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const pauseSchedule = (id: string) =>
  apiFetch<WorkflowSchedule>(`/workflow-schedules/${id}/pause`, { method: "POST" });

export const resumeSchedule = (id: string) =>
  apiFetch<WorkflowSchedule>(`/workflow-schedules/${id}/resume`, { method: "POST" });

// Reports
export const getOverviewReport = (params?: { days?: number }) =>
  apiFetch<WorkflowOverviewReport>(
    `/workflow-reports/overview${
      params ? "?" + new URLSearchParams(params as Record<string, string>) : ""
    }`,
  );

export const getSuccessFailureReport = (params?: { days?: number }) =>
  apiFetch<Record<string, unknown>>(
    `/workflow-reports/success-failure${
      params ? "?" + new URLSearchParams(params as Record<string, string>) : ""
    }`,
  );

export const getPerformanceReport = (params?: { days?: number }) =>
  apiFetch<Record<string, unknown>>(
    `/workflow-reports/performance${
      params ? "?" + new URLSearchParams(params as Record<string, string>) : ""
    }`,
  );
