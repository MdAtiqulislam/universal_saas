import {
  ReturnRequest,
  ReturnReason,
  ReturnPolicy,
  ReturnDispositionRecord,
  ReturnResolution,
} from "../types/returns.types";

const API_BASE = "/api/v1/returns";

export const returnsApi = {
  // Returns Requests
  async listReturns(params?: Record<string, string>): Promise<ReturnRequest[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}${query}`);
    if (!res.ok) throw new Error("Failed to fetch return requests");
    return res.json();
  },

  async getReturn(id: string): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error("Failed to fetch return request details");
    return res.json();
  },

  async createReturn(payload: Record<string, unknown>): Promise<ReturnRequest> {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to create return request" }));
      throw new Error(err.message || "Failed to create return request");
    }
    return res.json();
  },

  async updateReturn(id: string, payload: Record<string, unknown>): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update return request");
    return res.json();
  },

  async submitReturn(id: string): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}/submit`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to submit return request");
    return res.json();
  },

  async reviewReturn(id: string, payload: { reviewNotes?: string }): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to start return review");
    return res.json();
  },

  async authorizeReturn(
    id: string,
    payload: {
      authorizationNotes?: string;
      lineAuthorizations?: Array<{ lineId: string; authorizedQuantity: number }>;
    },
  ): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to authorize return" }));
      throw new Error(err.message || "Failed to authorize return");
    }
    return res.json();
  },

  async rejectReturn(id: string, payload: { rejectionReason: string }): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to reject return");
    return res.json();
  },

  async cancelReturn(id: string, reason?: string): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error("Failed to cancel return");
    return res.json();
  },

  async closeReturn(id: string): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}/close`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to close return");
    return res.json();
  },

  // Receiving
  async receiveReturn(id: string, payload: Record<string, unknown>): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to receive returned goods" }));
      throw new Error(err.message || "Failed to receive returned goods");
    }
    return res.json();
  },

  // Quality Inspection
  async requestInspection(id: string, payload: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${API_BASE}/${id}/request-inspection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to request return inspection");
    return res.json();
  },

  async syncInspection(id: string): Promise<ReturnRequest> {
    const res = await fetch(`${API_BASE}/${id}/sync-inspection`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to sync inspection result");
    return res.json();
  },

  // Dispositions
  async getDispositions(returnId: string): Promise<ReturnDispositionRecord[]> {
    const res = await fetch(`${API_BASE}/${returnId}/dispositions`);
    if (!res.ok) throw new Error("Failed to fetch dispositions");
    return res.json();
  },

  async createDispositions(
    returnId: string,
    payload: Record<string, unknown>,
  ): Promise<ReturnDispositionRecord[]> {
    const res = await fetch(`${API_BASE}/${returnId}/dispositions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to create dispositions" }));
      throw new Error(err.message || "Failed to create dispositions");
    }
    return res.json();
  },

  // Financial Resolutions
  async getResolutions(returnId: string): Promise<ReturnResolution[]> {
    const res = await fetch(`${API_BASE}/${returnId}/resolutions`);
    if (!res.ok) throw new Error("Failed to fetch resolutions");
    return res.json();
  },

  async createCreditNote(
    returnId: string,
    payload: Record<string, unknown>,
  ): Promise<ReturnResolution> {
    const res = await fetch(`${API_BASE}/${returnId}/credit-note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ message: "Failed to create credit note resolution" }));
      throw new Error(err.message || "Failed to create credit note resolution");
    }
    return res.json();
  },

  async createRefund(
    returnId: string,
    payload: Record<string, unknown>,
  ): Promise<ReturnResolution> {
    const res = await fetch(`${API_BASE}/${returnId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to create refund resolution" }));
      throw new Error(err.message || "Failed to create refund resolution");
    }
    return res.json();
  },

  async createDebitNote(
    returnId: string,
    payload: Record<string, unknown>,
  ): Promise<ReturnResolution> {
    const res = await fetch(`${API_BASE}/${returnId}/debit-note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ message: "Failed to create debit note resolution" }));
      throw new Error(err.message || "Failed to create debit note resolution");
    }
    return res.json();
  },

  async createReplacement(
    returnId: string,
    payload: Record<string, unknown>,
  ): Promise<ReturnResolution> {
    const res = await fetch(`${API_BASE}/${returnId}/replacement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ message: "Failed to create replacement resolution" }));
      throw new Error(err.message || "Failed to create replacement resolution");
    }
    return res.json();
  },

  // Reasons & Policies
  async listReasons(): Promise<ReturnReason[]> {
    const res = await fetch(`${API_BASE}/reasons`);
    if (!res.ok) throw new Error("Failed to fetch return reasons");
    return res.json();
  },

  async createReason(payload: Record<string, unknown>): Promise<ReturnReason> {
    const res = await fetch(`${API_BASE}/reasons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create return reason");
    return res.json();
  },

  async getPolicy(): Promise<ReturnPolicy> {
    const res = await fetch(`${API_BASE}/policy`);
    if (!res.ok) throw new Error("Failed to fetch return policy");
    return res.json();
  },

  async updatePolicy(payload: Record<string, unknown>): Promise<ReturnPolicy> {
    const res = await fetch(`${API_BASE}/policy`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update return policy");
    return res.json();
  },

  // Reports
  async getReport(reportType: string, params?: Record<string, string>): Promise<unknown> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/reports/${reportType}${query}`);
    if (!res.ok) throw new Error(`Failed to fetch ${reportType} report`);
    return res.json();
  },
};
