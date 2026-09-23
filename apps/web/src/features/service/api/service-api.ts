import {
  CustomerAsset,
  WarrantyPolicy,
  ServiceRequest,
  ServiceTicket,
  ServiceDiagnosis,
  ServiceEstimate,
  ServiceOrder,
  ServicePartRequirement,
  ServiceLaborEntry,
  ServiceHandover,
  ServiceSummaryReport,
} from "../types/service.types";

const API_BASE = "/api/v1/service";

export const serviceApi = {
  // Customer Assets
  async listCustomerAssets(params?: Record<string, string>): Promise<CustomerAsset[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/customer-assets${query}`);
    if (!res.ok) throw new Error("Failed to fetch customer assets");
    return res.json();
  },

  async getCustomerAsset(id: string): Promise<CustomerAsset> {
    const res = await fetch(`${API_BASE}/customer-assets/${id}`);
    if (!res.ok) throw new Error("Failed to fetch customer asset");
    return res.json();
  },

  async getCustomerAssetHistory(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/customer-assets/${id}/history`);
    if (!res.ok) throw new Error("Failed to fetch asset service history");
    return res.json();
  },

  async createCustomerAsset(payload: Record<string, unknown>): Promise<CustomerAsset> {
    const res = await fetch(`${API_BASE}/customer-assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to register customer asset");
    return res.json();
  },

  // Warranty
  async listWarrantyPolicies(isActive?: boolean): Promise<WarrantyPolicy[]> {
    const query = isActive !== undefined ? `?isActive=${isActive}` : "";
    const res = await fetch(`${API_BASE}/warranty-policies${query}`);
    if (!res.ok) throw new Error("Failed to fetch warranty policies");
    return res.json();
  },

  async createWarrantyPolicy(payload: Record<string, unknown>): Promise<WarrantyPolicy> {
    const res = await fetch(`${API_BASE}/warranty-policies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create warranty policy");
    return res.json();
  },

  async checkWarrantyEligibility(payload: {
    customerAssetId: string;
    serviceDate?: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/warranty/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to check warranty eligibility");
    return res.json();
  },

  // Service Requests
  async listServiceRequests(params?: Record<string, string>): Promise<ServiceRequest[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/requests${query}`);
    if (!res.ok) throw new Error("Failed to fetch service requests");
    return res.json();
  },

  async createServiceRequest(payload: Record<string, unknown>): Promise<ServiceRequest> {
    const res = await fetch(`${API_BASE}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create service request");
    return res.json();
  },

  async triageServiceRequest(
    id: string,
    payload: { triageNotes: string; assignedTechnicianId?: string },
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/requests/${id}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to triage service request");
    return res.json();
  },

  // Service Tickets
  async listServiceTickets(params?: Record<string, string>): Promise<ServiceTicket[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/tickets${query}`);
    if (!res.ok) throw new Error("Failed to fetch service tickets");
    return res.json();
  },

  async getServiceTicket(id: string): Promise<ServiceTicket> {
    const res = await fetch(`${API_BASE}/tickets/${id}`);
    if (!res.ok) throw new Error("Failed to fetch service ticket");
    return res.json();
  },

  async assignTechnician(
    id: string,
    payload: { employeeId: string; role?: string },
  ): Promise<ServiceTicket> {
    const res = await fetch(`${API_BASE}/tickets/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to assign technician");
    return res.json();
  },

  async recordDiagnosis(
    ticketId: string,
    payload: Record<string, unknown>,
  ): Promise<ServiceDiagnosis> {
    const res = await fetch(`${API_BASE}/tickets/${ticketId}/diagnosis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to record diagnosis");
    return res.json();
  },

  async createEstimate(
    ticketId: string,
    payload: Record<string, unknown>,
  ): Promise<ServiceEstimate> {
    const res = await fetch(`${API_BASE}/tickets/${ticketId}/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create estimate");
    return res.json();
  },

  async approveEstimate(
    estimateId: string,
    payload: { approvedBy: string },
  ): Promise<ServiceEstimate> {
    const res = await fetch(`${API_BASE}/estimates/${estimateId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to approve estimate");
    return res.json();
  },

  // Service Orders
  async listServiceOrders(params?: Record<string, string>): Promise<ServiceOrder[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_BASE}/orders${query}`);
    if (!res.ok) throw new Error("Failed to fetch service orders");
    return res.json();
  },

  async getServiceOrder(id: string): Promise<ServiceOrder> {
    const res = await fetch(`${API_BASE}/orders/${id}`);
    if (!res.ok) throw new Error("Failed to fetch service order");
    return res.json();
  },

  async createServiceOrder(payload: Record<string, unknown>): Promise<ServiceOrder> {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create service order");
    return res.json();
  },

  async releaseServiceOrder(id: string): Promise<ServiceOrder> {
    const res = await fetch(`${API_BASE}/orders/${id}/release`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to release service order");
    return res.json();
  },

  async startServiceOrder(id: string): Promise<ServiceOrder> {
    const res = await fetch(`${API_BASE}/orders/${id}/start`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to start service order");
    return res.json();
  },

  async requestQualityCheck(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/orders/${id}/request-quality-check`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to request quality inspection");
    return res.json();
  },

  async completeServiceOrder(id: string): Promise<ServiceOrder> {
    const res = await fetch(`${API_BASE}/orders/${id}/complete`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to complete service order");
    return res.json();
  },

  async handoverServiceOrder(
    id: string,
    payload: { recipientName: string; acceptanceNotes?: string },
  ): Promise<ServiceHandover> {
    const res = await fetch(`${API_BASE}/orders/${id}/handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to process handover");
    return res.json();
  },

  async invoiceServiceOrder(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/orders/${id}/invoice`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to generate customer invoice");
    return res.json();
  },

  // Parts & Labor
  async issueParts(
    orderId: string,
    payload: { partRequirementId: string; quantity: number },
  ): Promise<ServicePartRequirement> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/parts/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to issue parts");
    return res.json();
  },

  async recordLabor(orderId: string, payload: Record<string, unknown>): Promise<ServiceLaborEntry> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/labor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to record labor");
    return res.json();
  },

  // Reports
  async getSummary(): Promise<ServiceSummaryReport> {
    const res = await fetch(`${API_BASE}/reports/summary`);
    if (!res.ok) throw new Error("Failed to fetch service summary");
    return res.json();
  },

  async getSlaReport(): Promise<any> {
    const res = await fetch(`${API_BASE}/reports/sla`);
    if (!res.ok) throw new Error("Failed to fetch SLA report");
    return res.json();
  },

  async getTechniciansReport(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/reports/technicians`);
    if (!res.ok) throw new Error("Failed to fetch technician productivity");
    return res.json();
  },

  async getWarrantyCostReport(): Promise<any> {
    const res = await fetch(`${API_BASE}/reports/warranty-cost`);
    if (!res.ok) throw new Error("Failed to fetch warranty cost report");
    return res.json();
  },

  async getProfitabilityReport(): Promise<any> {
    const res = await fetch(`${API_BASE}/reports/profitability`);
    if (!res.ok) throw new Error("Failed to fetch profitability report");
    return res.json();
  },

  async getPartsConsumptionReport(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/reports/parts`);
    if (!res.ok) throw new Error("Failed to fetch parts consumption report");
    return res.json();
  },
};
