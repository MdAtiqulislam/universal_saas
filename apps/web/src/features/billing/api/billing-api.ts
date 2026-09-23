import {
  BillingDashboardData,
  BillingAdminKpis,
  BillingPlan,
  BillingSubscription,
  EntitlementsSummary,
  BillingInvoice,
  BillingPayment,
  BillingCredit,
  BillingDiscount,
  MrrReport,
  ArrReport,
  InvoiceAgingReport,
  PaymentReliabilityReport,
  UsageSummaryItem,
  BillingQuota,
} from "../types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("current_org_id") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(orgId ? { "X-Organization-Id": orgId } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const body = (await res.json()) as {
        message?: string;
        error?: { message?: string };
      };
      errorMsg = body.message || body.error?.message || errorMsg;
    } catch {
      // Non-JSON error
    }
    throw new Error(errorMsg);
  }

  const json = (await res.json()) as { data?: T } | T;
  if (json && typeof json === "object" && "data" in json && json.data !== undefined) {
    return json.data as T;
  }
  return json as T;
}

export async function getBillingOverview(): Promise<BillingDashboardData> {
  return fetchJson<BillingDashboardData>("/api/v1/billing/dashboard/overview");
}

export async function getAdminKpis(): Promise<BillingAdminKpis> {
  return fetchJson<BillingAdminKpis>("/api/v1/billing/dashboard/admin-kpis");
}

export async function listPlans(): Promise<BillingPlan[]> {
  return fetchJson<BillingPlan[]>("/api/v1/billing/plans");
}

export async function getCurrentSubscription(): Promise<BillingSubscription | null> {
  return fetchJson<BillingSubscription | null>("/api/v1/billing/subscription");
}

export async function createSubscription(dto: {
  planVersionId: string;
  priceId?: string;
  trialDays?: number;
}): Promise<BillingSubscription> {
  return fetchJson<BillingSubscription>("/api/v1/billing/subscription", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function upgradeSubscription(dto: {
  newPlanVersionId: string;
  newPriceId?: string;
  immediate?: boolean;
}): Promise<{ subscription: BillingSubscription; proration: unknown }> {
  return fetchJson<{ subscription: BillingSubscription; proration: unknown }>(
    "/api/v1/billing/subscription/upgrade",
    {
      method: "POST",
      body: JSON.stringify(dto),
    },
  );
}

export async function cancelSubscription(dto: {
  immediately?: boolean;
  reason?: string;
}): Promise<BillingSubscription> {
  return fetchJson<BillingSubscription>("/api/v1/billing/subscription/cancel", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function pauseSubscription(): Promise<BillingSubscription> {
  return fetchJson<BillingSubscription>("/api/v1/billing/subscription/pause", {
    method: "POST",
  });
}

export async function resumeSubscription(): Promise<BillingSubscription> {
  return fetchJson<BillingSubscription>("/api/v1/billing/subscription/resume", {
    method: "POST",
  });
}

export async function getEntitlements(): Promise<EntitlementsSummary> {
  return fetchJson<EntitlementsSummary>("/api/v1/billing/entitlements");
}

export async function getUsageSummary(days: number = 30): Promise<UsageSummaryItem[]> {
  return fetchJson<UsageSummaryItem[]>(`/api/v1/billing/usage/summary?days=${days}`);
}

export async function listQuotas(): Promise<BillingQuota[]> {
  return fetchJson<BillingQuota[]>("/api/v1/billing/usage/quotas");
}

export async function listInvoices(
  status?: string,
): Promise<{ invoices: BillingInvoice[]; total: number }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchJson<{ invoices: BillingInvoice[]; total: number }>(
    `/api/v1/billing/invoices${query}`,
  );
}

export async function listPayments(limit: number = 50): Promise<BillingPayment[]> {
  return fetchJson<BillingPayment[]>(`/api/v1/billing/payments?limit=${limit}`);
}

export async function getCreditLedger(): Promise<{
  availableCredit: number;
  history: BillingCredit[];
}> {
  return fetchJson<{ availableCredit: number; history: BillingCredit[] }>(
    "/api/v1/billing/credits",
  );
}

export async function validateDiscount(
  code: string,
  subtotal?: number,
): Promise<{ valid: boolean; discount: BillingDiscount; calculatedDeduction: number }> {
  return fetchJson<{
    valid: boolean;
    discount: BillingDiscount;
    calculatedDeduction: number;
  }>("/api/v1/billing/credits/discounts/validate", {
    method: "POST",
    body: JSON.stringify({ code, subtotal }),
  });
}

export async function getMrrReport(): Promise<MrrReport> {
  return fetchJson<MrrReport>("/api/v1/billing/reports/mrr");
}

export async function getArrReport(): Promise<ArrReport> {
  return fetchJson<ArrReport>("/api/v1/billing/reports/arr");
}

export async function getInvoiceAgingReport(): Promise<InvoiceAgingReport> {
  return fetchJson<InvoiceAgingReport>("/api/v1/billing/reports/aging");
}

export async function getPaymentReliabilityReport(): Promise<PaymentReliabilityReport> {
  return fetchJson<PaymentReliabilityReport>("/api/v1/billing/reports/reliability");
}
