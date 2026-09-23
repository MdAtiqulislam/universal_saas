import {
  Lead,
  CustomerContact,
  Opportunity,
  CrmActivity,
  Quotation,
  PipelineSummary,
  StageBreakdownItem,
} from "../types/crm.types";

const API_BASE = "/api/v1/crm";

export const crmApi = {
  // Leads
  async listLeads(params?: Record<string, string>): Promise<Lead[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/leads${query}`);
    if (!res.ok) throw new Error("Failed to fetch leads");
    return res.json();
  },

  async getLead(id: string): Promise<Lead> {
    const res = await fetch(`${API_BASE}/leads/${id}`);
    if (!res.ok) throw new Error("Failed to fetch lead");
    return res.json();
  },

  async createLead(payload: Record<string, unknown>): Promise<Lead> {
    const res = await fetch(`${API_BASE}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create lead");
    return res.json();
  },

  async updateLead(id: string, payload: Record<string, unknown>): Promise<Lead> {
    const res = await fetch(`${API_BASE}/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update lead");
    return res.json();
  },

  async qualifyLead(
    id: string,
    payload: { qualificationNotes: string; estimatedValue?: number },
  ): Promise<Lead> {
    const res = await fetch(`${API_BASE}/leads/${id}/qualify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to qualify lead");
    return res.json();
  },

  async convertLead(
    id: string,
    payload: {
      existingCustomerId?: string;
      newCustomerName?: string;
      opportunityTitle?: string;
      estimatedValue?: number;
    },
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/leads/${id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to convert lead");
    return res.json();
  },

  async closeLead(id: string, payload: { lostReason: string }): Promise<Lead> {
    const res = await fetch(`${API_BASE}/leads/${id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to close lead");
    return res.json();
  },

  // Contacts
  async listContacts(params?: Record<string, string>): Promise<CustomerContact[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/contacts${query}`);
    if (!res.ok) throw new Error("Failed to fetch contacts");
    return res.json();
  },

  async createContact(payload: Record<string, unknown>): Promise<CustomerContact> {
    const res = await fetch(`${API_BASE}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create contact");
    return res.json();
  },

  // Opportunities
  async listOpportunities(params?: Record<string, string>): Promise<Opportunity[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/opportunities${query}`);
    if (!res.ok) throw new Error("Failed to fetch opportunities");
    return res.json();
  },

  async getOpportunity(id: string): Promise<Opportunity> {
    const res = await fetch(`${API_BASE}/opportunities/${id}`);
    if (!res.ok) throw new Error("Failed to fetch opportunity");
    return res.json();
  },

  async createOpportunity(payload: Record<string, unknown>): Promise<Opportunity> {
    const res = await fetch(`${API_BASE}/opportunities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create opportunity");
    return res.json();
  },

  async updateOpportunity(id: string, payload: Record<string, unknown>): Promise<Opportunity> {
    const res = await fetch(`${API_BASE}/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update opportunity");
    return res.json();
  },

  async changeOpportunityStage(
    id: string,
    payload: { stage: string; probability?: number },
  ): Promise<Opportunity> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to change stage");
    return res.json();
  },

  async closeOpportunityWon(
    id: string,
    payload: { notes?: string; wonDate?: string },
  ): Promise<Opportunity> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/close-won`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to mark opportunity won");
    return res.json();
  },

  async closeOpportunityLost(
    id: string,
    payload: { lostReason: string; lostDate?: string },
  ): Promise<Opportunity> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/close-lost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to mark opportunity lost");
    return res.json();
  },

  async addOpportunityLine(id: string, payload: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to add line");
    return res.json();
  },

  async removeOpportunityLine(id: string, lineId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/lines/${lineId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to remove line");
    return res.json();
  },

  // Activities
  async listActivities(params?: Record<string, string>): Promise<CrmActivity[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/activities${query}`);
    if (!res.ok) throw new Error("Failed to fetch activities");
    return res.json();
  },

  async createActivity(payload: Record<string, unknown>): Promise<CrmActivity> {
    const res = await fetch(`${API_BASE}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create activity");
    return res.json();
  },

  async completeActivity(id: string, payload: { outcome?: string }): Promise<CrmActivity> {
    const res = await fetch(`${API_BASE}/activities/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to complete activity");
    return res.json();
  },

  // Quotations
  async listQuotations(params?: Record<string, string>): Promise<Quotation[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/quotations${query}`);
    if (!res.ok) throw new Error("Failed to fetch quotations");
    return res.json();
  },

  async getQuotation(id: string): Promise<Quotation> {
    const res = await fetch(`${API_BASE}/quotations/${id}`);
    if (!res.ok) throw new Error("Failed to fetch quotation");
    return res.json();
  },

  async submitQuotation(id: string, payload?: { notes?: string }): Promise<Quotation> {
    const res = await fetch(`${API_BASE}/quotations/${id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) throw new Error("Failed to submit quotation");
    return res.json();
  },

  async approveQuotation(id: string): Promise<Quotation> {
    const res = await fetch(`${API_BASE}/quotations/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error("Failed to approve quotation");
    return res.json();
  },

  async rejectQuotation(id: string, payload: { rejectionReason: string }): Promise<Quotation> {
    const res = await fetch(`${API_BASE}/quotations/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to reject quotation");
    return res.json();
  },

  async sendQuotation(id: string): Promise<Quotation> {
    const res = await fetch(`${API_BASE}/quotations/${id}/send`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to send quotation");
    return res.json();
  },

  async acceptQuotation(
    id: string,
    payload: { acceptedBy: string; notes?: string },
  ): Promise<Quotation> {
    const res = await fetch(`${API_BASE}/quotations/${id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to accept quotation");
    return res.json();
  },

  async convertQuotation(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/quotations/${id}/convert`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to convert quotation to sales order");
    return res.json();
  },

  // Pipeline & Forecasting
  async getPipelineSummary(params?: Record<string, string>): Promise<PipelineSummary> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/pipeline/summary${query}`);
    if (!res.ok) throw new Error("Failed to fetch pipeline summary");
    return res.json();
  },

  async getPipelineStages(ownerEmployeeId?: string): Promise<StageBreakdownItem[]> {
    const query = ownerEmployeeId ? `?ownerEmployeeId=${ownerEmployeeId}` : "";
    const res = await fetch(`${API_BASE}/pipeline/stages${query}`);
    if (!res.ok) throw new Error("Failed to fetch stage breakdown");
    return res.json();
  },

  // Customer 360
  async getCustomer360(customerId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/customer-360/${customerId}`);
    if (!res.ok) throw new Error("Failed to fetch customer 360");
    return res.json();
  },

  // Reports
  async getReport(reportName: string, params?: Record<string, string>): Promise<any> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/reports/${reportName}${query}`);
    if (!res.ok) throw new Error(`Failed to fetch report ${reportName}`);
    return res.json();
  },
};
