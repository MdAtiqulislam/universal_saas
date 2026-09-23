export type LeadStatus =
  "NEW" | "CONTACTED" | "QUALIFIED" | "UNQUALIFIED" | "CONVERTED" | "LOST" | "CLOSED";
export type LeadSource =
  | "WEBSITE"
  | "REFERRAL"
  | "SOCIAL_MEDIA"
  | "CAMPAIGN"
  | "ADVERTISEMENT"
  | "PARTNER"
  | "COLD_OUTREACH"
  | "EXHIBITION"
  | "OTHER";
export type LeadPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type OpportunityStatus =
  "OPEN" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST" | "CLOSED";
export type OpportunityStage =
  | "PROSPECTING"
  | "QUALIFICATION"
  | "NEEDS_ANALYSIS"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";
export type ActivityType =
  "CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE" | "FOLLOW_UP" | "DEMO" | "SITE_VISIT" | "OTHER";
export type ActivityStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "OVERDUE";
export type QuotationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "CONVERTED"
  | "VOIDED";

export interface Lead {
  id: string;
  organizationId: string;
  leadNumber: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  designation?: string | null;
  assignedEmployeeId?: string | null;
  estimatedValue: number | string;
  expectedConversionDate?: string | null;
  notes?: string | null;
  qualificationNotes?: string | null;
  lostReason?: string | null;
  convertedCustomerId?: string | null;
  convertedOpportunityId?: string | null;
  convertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedEmployee?: { id: string; firstName: string; lastName: string } | null;
  convertedCustomer?: { id: string; name: string; code: string } | null;
  convertedOpportunity?: { id: string; opportunityNumber: string; title: string } | null;
}

export interface CustomerContact {
  id: string;
  organizationId: string;
  customerId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  designation?: string | null;
  department?: string | null;
  preferredCommunicationMethod?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  customer?: { id: string; name: string; code: string };
}

export interface OpportunityLine {
  id: string;
  opportunityId: string;
  itemId: string;
  variantId?: string | null;
  description?: string | null;
  quantity: number | string;
  unitPrice: number | string;
  discountAmount: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  estimatedAmount: number | string;
  item: { id: string; name: string; sku: string };
  variant?: { id: string; name: string; sku: string } | null;
}

export interface Opportunity {
  id: string;
  organizationId: string;
  opportunityNumber: string;
  customerId: string;
  primaryContactId?: string | null;
  leadId?: string | null;
  ownerEmployeeId?: string | null;
  title: string;
  description?: string | null;
  status: OpportunityStatus;
  stage: OpportunityStage;
  probability: number | string;
  estimatedValue: number | string;
  expectedCloseDate?: string | null;
  source: LeadSource;
  currencyId?: string | null;
  lostReason?: string | null;
  wonDate?: string | null;
  lostDate?: string | null;
  closedDate?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; code: string };
  primaryContact?: CustomerContact | null;
  ownerEmployee?: { id: string; firstName: string; lastName: string } | null;
  lines?: OpportunityLine[];
}

export interface CrmActivity {
  id: string;
  organizationId: string;
  type: ActivityType;
  subject: string;
  description?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  status: ActivityStatus;
  assignedEmployeeId?: string | null;
  outcome?: string | null;
  followUpDate?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
  customerId?: string | null;
  contactId?: string | null;
  createdAt: string;
  assignedEmployee?: { id: string; firstName: string; lastName: string } | null;
  customer?: { id: string; name: string; code: string } | null;
  contact?: CustomerContact | null;
  lead?: Lead | null;
  opportunity?: Opportunity | null;
}

export interface QuotationLine {
  id: string;
  quotationId: string;
  itemId: string;
  variantId?: string | null;
  description?: string | null;
  quantity: number | string;
  unitPrice: number | string;
  discountAmount: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  lineTotal: number | string;
  item: { id: string; name: string; sku: string };
  variant?: { id: string; name: string; sku: string } | null;
}

export interface Quotation {
  id: string;
  organizationId: string;
  quotationNumber: string;
  customerId: string;
  opportunityId?: string | null;
  contactId?: string | null;
  currencyId: string;
  locationId: string;
  status: QuotationStatus;
  quotationDate: string;
  validUntil?: string | null;
  notes?: string | null;
  terms?: string | null;
  subtotal: number | string;
  discountTotal: number | string;
  taxTotal: number | string;
  shippingTotal: number | string;
  grandTotal: number | string;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  isImmutable: boolean;
  createdAt: string;
  customer?: { id: string; name: string; code: string };
  opportunity?: Opportunity | null;
  contact?: CustomerContact | null;
  lines?: QuotationLine[];
  salesOrders?: Array<{
    id: string;
    orderNumber: string;
    status: string;
    grandTotal: number | string;
  }>;
}

export interface PipelineSummary {
  pipeline: {
    totalOpenOpportunities: number;
    totalOpenValue: number;
    weightedPipelineValue: number;
    wonOpportunities: number;
    wonValue: number;
    lostOpportunities: number;
    lostValue: number;
    winRatePercentage: number;
    averageSalesCycleDays: number;
  };
  leads: {
    total: number;
    new: number;
    qualified: number;
    converted: number;
    lost: number;
  };
  quotations: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    accepted: number;
    converted: number;
  };
}

export interface StageBreakdownItem {
  stage: OpportunityStage;
  count: number;
  totalValue: number;
  weightedValue: number;
}
