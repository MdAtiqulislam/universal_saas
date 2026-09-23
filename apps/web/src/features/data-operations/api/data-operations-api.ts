import {
  DataOperationDefinition,
  DataOperationJob,
  ImportPreviewResult,
  ExportResult,
} from "../types";

export const dataOperationsApi = {
  async listDefinitions(): Promise<DataOperationDefinition[]> {
    const res = await fetch("/api/v1/data-operations/definitions");
    if (!res.ok) throw new Error("Failed to fetch definitions");
    return res.json();
  },

  async exportData(params: {
    operationKey: string;
    fields?: string[];
    format?: "CSV" | "JSON";
    limit?: number;
  }): Promise<ExportResult> {
    const res = await fetch("/api/v1/data-operations/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Export failed" }));
      throw new Error(err.message || "Export failed");
    }
    return res.json();
  },

  async previewImport(params: {
    operationKey: string;
    fileContent: string;
    format?: "CSV" | "JSON";
    mode?: string;
  }): Promise<ImportPreviewResult> {
    const res = await fetch("/api/v1/data-operations/imports/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Preview failed" }));
      throw new Error(err.message || "Preview failed");
    }
    return res.json();
  },

  async commitImport(params: {
    operationKey: string;
    fileContent: string;
    jobId?: string;
    format?: "CSV" | "JSON";
    mode?: string;
  }): Promise<any> {
    const res = await fetch("/api/v1/data-operations/imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Commit failed" }));
      throw new Error(err.message || "Commit failed");
    }
    return res.json();
  },

  async listJobs(): Promise<{ jobs: DataOperationJob[]; total: number }> {
    const res = await fetch("/api/v1/data-operations/jobs");
    if (!res.ok) throw new Error("Failed to list jobs");
    return res.json();
  },

  async cancelJob(id: string): Promise<DataOperationJob> {
    const res = await fetch(`/api/v1/data-operations/jobs/${id}/cancel`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to cancel job");
    return res.json();
  },
};
