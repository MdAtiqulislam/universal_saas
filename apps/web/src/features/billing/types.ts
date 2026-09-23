export type BillingPlanStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type BillingInterval = "MONTHLY" | "YEARLY" | "CUSTOM";
export type BillingPricingModel =
  "FLAT" | "PER_UNIT" | "TIERED" | "VOLUME" | "USAGE_BASED" | "HYBRID";
export type BillingSubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "PAUSED"
  | "CANCELLED"
  | "EXPIRED"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED";
export type BillingQuotaType = "HARD_LIMIT" | "SOFT_LIMIT" | "UNLIMITED";
export type BillingInvoiceStatus =
  "DRAFT" | "OPEN" | "PAID" | "PARTIALLY_PAID" | "VOID" | "UNCOLLECTIBLE";
export type BillingPaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
export type BillingCreditType = "FIXED_AMOUNT" | "PERCENTAGE";
export type BillingDiscountDuration = "ONCE" | "RECURRING" | "FOREVER";

export interface BillingPrice {
  id: string;
  currency: string;
  interval: BillingInterval;
  pricingModel: BillingPricingModel;
  unitAmount: number; // minor units
}

export interface BillingFeature {
  id: string;
  key: string;
  name: string;
  description?: string;
  valueType: string;
}

export interface BillingPlanFeature {
  id: string;
  enabled: boolean;
  numericLimit?: number | null;
  isUnlimited: boolean;
  feature: BillingFeature;
}

export interface BillingPlanVersion {
  id: string;
  planId: string;
  version: number;
  name: string;
  isPublished: boolean;
  checksum?: string;
  effectiveFrom?: string;
  prices: BillingPrice[];
  features: BillingPlanFeature[];
}

export interface BillingPlan {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: BillingPlanStatus;
  isPublic: boolean;
  sortOrder: number;
  versions: BillingPlanVersion[];
}

export interface BillingSubscription {
  id: string;
  organizationId: string;
  planVersionId: string;
  priceId?: string;
  status: BillingSubscriptionStatus;
  scope: string;
  trialStart?: string;
  trialEnd?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  planVersion: {
    id: string;
    version: number;
    name: string;
    plan: {
      id: string;
      key: string;
      name: string;
    };
  };
  price?: BillingPrice;
}

export interface BillingQuota {
  metricKey: string;
  quotaType: BillingQuotaType;
  allocatedAmount: number;
  authorizedOverride: number | null;
  effectiveLimit: number;
  currentUsage: number;
  usagePercent: number;
}

export interface EntitlementsSummary {
  organizationId: string;
  hasActiveSubscription: boolean;
  subscriptionId?: string;
  planName?: string;
  planVersion?: number;
  features: {
    key: string;
    name: string;
    enabled: boolean;
    isUnlimited: boolean;
    limit: number | null;
  }[];
  quotas: BillingQuota[];
}

export interface BillingInvoiceLineItem {
  id: string;
  description: string;
  itemType: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
}

export interface BillingPayment {
  id: string;
  amount: number;
  currency: string;
  status: BillingPaymentStatus;
  providerKey: string;
  providerTransactionId?: string;
  failureReason?: string;
  paidAt?: string;
  createdAt: string;
  invoice?: {
    invoiceNumber: string;
    totalAmount: number;
    status: BillingInvoiceStatus;
  };
}

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  status: BillingInvoiceStatus;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  creditApplied: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  issueDate: string;
  dueDate: string;
  finalizedAt?: string;
  paidAt?: string;
  voidedAt?: string;
  lineItems?: BillingInvoiceLineItem[];
  payments?: BillingPayment[];
}

export interface BillingCredit {
  id: string;
  amount: number;
  currency: string;
  reason?: string;
  consumedAmount: number;
  expiresAt?: string;
  createdAt: string;
}

export interface BillingDiscount {
  id: string;
  code: string;
  name: string;
  discountType: BillingCreditType;
  value: number;
  duration: BillingDiscountDuration;
  validUntil?: string;
  maxRedemptions?: number;
  timesRedeemed: number;
}

export interface BillingDashboardData {
  organizationId: string;
  subscription: BillingSubscription | null;
  entitlements: EntitlementsSummary;
  recentInvoices: BillingInvoice[];
  recentPayments: BillingPayment[];
  financials: {
    availableCredit: number;
    totalOutstandingAmount: number;
    currency: string;
  };
}

export interface BillingAdminKpis {
  mrr: number;
  arr: number;
  subscriptionCount: number;
  statusSummary: { status: BillingSubscriptionStatus; count: number }[];
  paymentSuccessRate: number;
  totalVolumeCollected: number;
  currency: string;
}

export interface MrrReport {
  currency: string;
  totalMrr: number;
  subscriptionCount: number;
  breakdownByPlan: {
    planKey: string;
    planName: string;
    subscriptionCount: number;
    mrr: number;
  }[];
}

export interface ArrReport {
  currency: string;
  totalArr: number;
  totalMrr: number;
  subscriptionCount: number;
}

export interface InvoiceAgingReport {
  currency: string;
  current0To30Days: number;
  pastDue31To60Days: number;
  pastDue61To90Days: number;
  pastDue90PlusDays: number;
  totalOutstanding: number;
}

export interface PaymentReliabilityReport {
  totalAttempts: number;
  succeededCount: number;
  failedCount: number;
  successRatePercentage: number;
  totalVolumeCollected: number;
}

export interface UsageSummaryItem {
  metricKey: string;
  _sum: { quantity: number | null };
  _count: { id: number };
}
