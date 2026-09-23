# M35: CRM, Customer Relationship & Sales Pipeline Foundation

## Executive Summary

Milestone M35 delivers an enterprise-grade, multi-tenant CRM and commercial sales pipeline foundation for the Universal Business Operations SaaS platform. M35 orchestrates the end-to-end presales and commercial intake lifecycle: **Lead → Lead Qualification → Opportunity → Quotation → Customer Acceptance → Sales Order**.

M35 operates as an orchestration and composite read-model domain over authoritative existing engines (M11 Master Data, M14 Customer Invoicing, M15 Payments, M28 Sales Orders, M29 Shipments, M30 Warehousing, M31 Quality Control, M32 Reverse Logistics, M34 Service Management) without duplicating tables or commercial business logic.

---

## 1. Domain Architecture & Core Lifecycle

```text
┌─────────────────┐
│     Lead        │ (Sources: Website, Referral, Social, Campaigns, Exhibitions)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Qualification   │ (BANT assessment, revised estimated value, target dates)
└────────┬────────┘
         │
         ▼ (1-Click Atomic Conversion)
┌─────────────────┐      ┌─────────────────────────┐
│   Opportunity   │ ───► │ M11 Customer & Contacts │
└────────┬────────┘      └─────────────────────────┘
         │ (Opportunity Lines & Stages)
         ▼
┌─────────────────┐
│    Quotation    │ (Internal review, multi-tier pricing, taxes, terms)
└────────┬────────┘
         │
         ▼ (Submit → Approve → Send)
┌─────────────────┐
│ Client Accepted │ (Recorded signatory, immutability locked)
└────────┬────────┘
         │
         ▼ (1-Click Order Conversion)
┌─────────────────┐
│ M28 Sales Order │ ──► Warehouse (M30) ──► Shipment (M29) ──► Invoice (M14) ──► Payment (M15)
└─────────────────┘
```

---

## 2. Key Capabilities & Engine Features

### 2.1 Lead Intake & Structured Qualification

- Multi-channel capture (Website, Referral, Social Media, Campaigns, Ads, Partners, Exhibitions).
- Qualification workflow recording BANT assessments and probability targets.
- 1-Click atomic conversion creating authoritative `Customer` accounts, primary contacts, and opening `Opportunity` deals in a single database transaction.

### 2.2 Opportunity Management & Kanban Pipeline Board

- 7 distinct pipeline stages: `PROSPECTING` (10%), `QUALIFICATION` (25%), `NEEDS_ANALYSIS` (50%), `PROPOSAL` (75%), `NEGOTIATION` (90%), `CLOSED_WON` (100%), and `CLOSED_LOST` (0%).
- Itemized Opportunity Lines calculating unit pricing, volume discounts, and taxes with high-precision arithmetic (`Prisma.Decimal`).
- Visual Kanban board with stage value headers, probability badges, and quick win/loss modal logging.

### 2.3 Proposal & Quotation Governance

- Rigorous quotation lifecycle: `DRAFT` → `SUBMITTED` → `APPROVED` → `SENT` → `ACCEPTED` → `CONVERTED` (or `REJECTED` / `VOIDED`).
- Immutability locking (`isImmutable: true`) upon acceptance and conversion to protect commercial terms.
- 1-click seamless conversion to authoritative M28 Sales Orders without price or item discrepancy.

### 2.4 Customer 360 Degree View

- Single-pane composite view unifying:
  - Account profile, billing/shipping addresses, and contacts
  - Presales leads and active opportunity deals
  - Authoritative Sales Orders (M28) and Logistics Shipments (M29)
  - Accounts Receivable Invoices (M14) and Payment receipts (M15)
  - Installed base equipment, warranties, and field service orders (M34)
  - Customer quality issues (M31) and RMA return requests (M32)
  - Touchpoint timeline across calls, emails, meetings, tasks, and follow-ups.

### 2.5 Forecasting & Business Intelligence Reports

- 12 comprehensive analytical reports:
  1. Lead Conversion Funnel
  2. Lead Source Performance
  3. Opportunity Pipeline Matrix
  4. Weighted Pipeline Revenue Forecast
  5. Opportunity Aging Buckets (0-30, 31-60, 61-90, 90+ days)
  6. Win / Loss Reason Analysis
  7. Sales Rep Activity & Revenue Performance
  8. Sales Cycle Duration Metrics
  9. Quotation Conversion Rate & Quoted vs. Booked Value
  10. Customer Acquisition Report
  11. Monthly Revenue Forecasting
  12. Customer 360 Touchpoint Log

---

## 3. Database Invariants (251–275)

| Invariant | Description                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| **251**   | `Lead.leadNumber` is unique per organization (`@@unique([organizationId, leadNumber])`).                               |
| **252**   | Lead lifecycle conforms to transitions: `NEW` → `CONTACTED` → `QUALIFIED` → `CONVERTED` / `LOST` / `CLOSED`.           |
| **253**   | Converted leads cannot transition back to `NEW`, `CONTACTED`, or `QUALIFIED`.                                          |
| **254**   | Lead 1-click conversion requires valid customerId and opportunityId references.                                        |
| **255**   | Lead `estimatedValue` must be non-negative `Decimal(18, 4)`.                                                           |
| **256**   | `Opportunity.opportunityNumber` is unique per organization (`@@unique([organizationId, opportunityNumber])`).          |
| **257**   | Opportunity must be linked to an authoritative Customer (`customerId` NOT NULL).                                       |
| **258**   | Opportunity probability must be between 0.00% and 100.00%.                                                             |
| **259**   | Opportunity stage progression respects `CLOSED_WON` (100% prob) and `CLOSED_LOST` (0% prob, lostReason set).           |
| **260**   | Opportunity `estimatedValue` equals sum of opportunity lines `estimatedAmount`.                                        |
| **261**   | OpportunityLine `estimatedAmount` equals `(quantity * unitPrice - discountAmount) + taxAmount`.                        |
| **262**   | Quotation `quotationNumber` is unique per organization (`@@unique([organizationId, quotationNumber])`).                |
| **263**   | Quotation can optionally link to Opportunity and Primary Contact.                                                      |
| **264**   | Quotation status lifecycle requires `SUBMITTED` before `APPROVED`.                                                     |
| **265**   | Quotation cannot be sent unless `APPROVED` or `DRAFT`.                                                                 |
| **266**   | Quotation cannot be converted to Sales Order unless `ACCEPTED`.                                                        |
| **267**   | Converted Quotation becomes immutable (`isImmutable: true`) and cannot be modified or re-converted.                    |
| **268**   | Quotation conversion to M28 Sales Order creates exact line items without price divergence.                             |
| **269**   | CrmActivity must link to at least one valid CRM entity (`leadId`, `opportunityId`, `customerId`, `contactId`).         |
| **270**   | Completed CrmActivity requires `completedAt` timestamp and can record outcome.                                         |
| **271**   | CustomerContact `isPrimary` constraint ensures only one primary contact per customer when flagged.                     |
| **272**   | Weighted pipeline forecast equals $\sum (\text{estimatedValue} \times \frac{\text{probability}}{100})$.                |
| **273**   | Win rate calculation accurately computes $\frac{\text{Won Count}}{\text{Won Count} + \text{Lost Count}} \times 100$.   |
| **274**   | Customer 360 aggregates cross-domain entities without data duplication.                                                |
| **275**   | Multi-tenant isolation: CRM leads, opportunities, quotations, and activities partitioned strictly by `organizationId`. |
