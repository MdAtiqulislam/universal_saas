# M35: CRM, Customer Relationship & Sales Pipeline Foundation — Implementation Report

## Milestone Metadata

- **Milestone Code**: M35
- **Milestone Title**: CRM, Customer Relationship & Sales Pipeline Foundation
- **Target Domain**: Presales, Lead Management, Opportunity Forecasting, Quotation Governance, Customer 360
- **Status**: Completed & Verified
- **Date**: 2026-08-30

---

## 1. Executive Summary

Milestone M35 successfully establishes an enterprise-grade commercial intake and sales pipeline domain for the Universal Business Operations SaaS platform. M35 unifies presales and commercial activities into a cohesive pipeline: **Lead → Lead Qualification → Opportunity → Quotation → Customer Acceptance → Sales Order**.

M35 functions as an orchestration and composite read-model domain over authoritative downstream engines (M11 Master Data, M14 AR Invoicing, M15 Payments, M28 Sales Orders, M29 Shipping & Logistics, M30 Warehousing, M31 Quality Management, M32 Reverse Logistics & RMA, and M34 Service Management & Warranty) with zero data duplication.

---

## 2. Core Architectural Components Delivered

### 2.1 Database Schema & Migration

- **Migration**: `apps/api/prisma/migrations/20260830003800_add_crm_and_sales_pipeline/migration.sql`
- **Models**:
  - `Lead`: Tracks raw prospects, multi-channel sources, priority, estimated deal value, notes, qualification assessments, and atomic conversion links.
  - `Opportunity`: Central deal aggregate tracking title, customer, owner employee, 7 pipeline stages, probability percentages, itemized lines, and win/loss timestamps.
  - `OpportunityLine`: Line items with quantity, unit price, discounts, taxes, and total estimated amounts.
  - `CrmActivity`: Append-oriented activity and touchpoint log (calls, emails, meetings, tasks, follow-ups, demos, site visits).
  - `CustomerContact` (Enhanced): Added mobile, department, preferred communication method, and active status flags.
  - `Quotation` (Enhanced): Added opportunity linking, contact linking, approval metadata (`approvedByUserId`, `approvedAt`), acceptance metadata (`acceptedBy`, `acceptedAt`), immutability locks (`isImmutable`), and expanded status lifecycle.

### 2.2 RBAC Permissions & Roles

- Added 22 granular permissions in `apps/api/prisma/seed.ts`:
  - `crm.leads.*` (`view`, `manage`, `qualify`, `convert`, `close`)
  - `crm.contacts.*` (`view`, `manage`)
  - `crm.opportunities.*` (`view`, `manage`, `assign`, `stage`, `close`)
  - `crm.activities.*` (`view`, `manage`, `complete`)
  - `crm.quotations.*` (`view`, `manage`, `submit`, `approve`, `send`, `accept`, `convert`)
  - `crm.pipeline.view`, `crm.customer-360.view`, `crm.reports.view`
- Fully mapped to `ADMIN` (all) and `VIEWER` (view-only) system roles.

### 2.3 Domain Audit Events

- Registered 20 domain events in `apps/api/src/audit/audit-event.listener.ts`:
  - `LEAD_CREATED`, `LEAD_UPDATED`, `LEAD_QUALIFIED`, `LEAD_CONVERTED`, `LEAD_LOST`, `LEAD_CLOSED`
  - `CONTACT_CREATED`, `CONTACT_UPDATED`
  - `OPPORTUNITY_CREATED`, `OPPORTUNITY_UPDATED`, `OPPORTUNITY_ASSIGNED`, `OPPORTUNITY_STAGE_CHANGED`, `OPPORTUNITY_WON`, `OPPORTUNITY_LOST`, `OPPORTUNITY_CLOSED`
  - `CRM_ACTIVITY_CREATED`, `CRM_ACTIVITY_UPDATED`, `CRM_ACTIVITY_COMPLETED`
  - `QUOTATION_SUBMITTED`, `QUOTATION_APPROVED`, `QUOTATION_REJECTED`, `QUOTATION_SENT`, `QUOTATION_ACCEPTED`, `QUOTATION_EXPIRED`, `QUOTATION_CONVERTED`, `QUOTATION_CANCELLED`, `QUOTATION_VOIDED`
  - `CRM_FORECAST_GENERATED`

### 2.4 Backend Domain Services & Controllers (`apps/api/src/crm/`)

- `CrmLeadsService` & `CrmLeadsController`: Full CRUD, qualification workflow, and atomic 1-click conversion transaction into Customer & Opportunity.
- `CrmContactsService` & `CrmContactsController`: Management of customer contacts with primary contact constraint handling.
- `CrmOpportunitiesService` & `CrmOpportunitiesController`: Opportunity deal management, itemized pricing arithmetic, stage transitions, and won/lost closures.
- `CrmActivitiesService` & `CrmActivitiesController`: Touchpoint logging and outcome tracking.
- `CrmQuotationsService` & `CrmQuotationsController`: Quotation approval governance, customer acceptance recording, immutability locking, and conversion to M28 Sales Orders.
- `CrmPipelineService` & `CrmPipelineController`: Probability-weighted pipeline forecasting, win rate telemetry, and sales cycle duration calculations.
- `CrmCustomer360Service` & `CrmCustomer360Controller`: Composite cross-engine read model unifying customer profile, orders, invoices, payments, shipments, service, and quality.
- `CrmReportsService` & `CrmReportsController`: 12 authoritative business intelligence and forecasting reports.
- `CrmModule`: Registered cleanly into `AppModule`.

### 2.5 Frontend Next.js Application (`apps/web`)

- Feature folder: `apps/web/src/features/crm/`
  - `types/crm.types.ts`: Comprehensive TypeScript interfaces.
  - `api/crm-api.ts`: Typed API client.
  - `components/crm-dashboard.tsx`: Commercial pipeline KPIs and stage breakdown matrix.
  - `components/crm-lead-list.tsx`: Lead list with qualification and 1-click conversion modals.
  - `components/crm-opportunity-kanban.tsx`: Visual deal board with stage headers and stage move selectors.
  - `components/crm-quotation-list.tsx`: Proposal governance with submit, approve, reject, accept, and sales order conversion buttons.
  - `components/crm-activity-list.tsx`: Touchpoint feed and log activity dialog.
  - `components/crm-customer-360-view.tsx`: Unified cross-domain account portrait with tabbed domain views and KPI badges.
  - `components/crm-reports-view.tsx`: 12-report intelligence viewer.
- Page Route: `apps/web/src/app/crm/page.tsx`

---

## 3. Database Invariants Implemented & Tested (251–275)

All 25 consecutive database invariants (251–275) have been implemented and verified in `apps/api/src/prisma/database-invariants.spec.ts`:

- **Invariant 251**: Lead leadNumber is unique per organization (`@@unique([organizationId, leadNumber])`)
- **Invariant 252**: Lead status lifecycle conforms to valid transitions
- **Invariant 253**: Converted lead cannot transition back to NEW, CONTACTED, or QUALIFIED
- **Invariant 254**: Lead 1-click conversion requires valid customerId and opportunityId references
- **Invariant 255**: Lead estimatedValue must be non-negative Decimal(18, 4)
- **Invariant 256**: Opportunity opportunityNumber is unique per organization (`@@unique([organizationId, opportunityNumber])`)
- **Invariant 257**: Opportunity must be linked to an authoritative Customer (`customerId` NOT NULL)
- **Invariant 258**: Opportunity probability must be between 0.00% and 100.00%
- **Invariant 259**: Opportunity stage progression respects CLOSED_WON (100% prob) and CLOSED_LOST (0% prob, lostReason set)
- **Invariant 260**: Opportunity estimatedValue equals sum of opportunity lines estimatedAmount
- **Invariant 261**: OpportunityLine estimatedAmount equals `(quantity * unitPrice - discountAmount) + taxAmount`
- **Invariant 262**: Quotation quotationNumber is unique per organization (`@@unique([organizationId, quotationNumber])`)
- **Invariant 263**: Quotation can optionally link to Opportunity and Primary Contact
- **Invariant 264**: Quotation status lifecycle requires SUBMITTED before APPROVED
- **Invariant 265**: Quotation cannot be sent unless APPROVED or DRAFT
- **Invariant 266**: Quotation cannot be converted to Sales Order unless ACCEPTED
- **Invariant 267**: Converted Quotation becomes immutable (`isImmutable: true`) and cannot be modified or re-converted
- **Invariant 268**: Quotation conversion to M28 Sales Order creates exact line items without price divergence
- **Invariant 269**: CrmActivity must link to at least one valid CRM entity (`leadId`, `opportunityId`, `customerId`, `contactId`)
- **Invariant 270**: Completed CrmActivity requires completedAt timestamp and can record outcome
- **Invariant 271**: CustomerContact isPrimary constraint ensures only one primary contact per customer when flagged
- **Invariant 272**: Weighted pipeline forecast equals $\sum (\text{estimatedValue} \times \frac{\text{probability}}{100})$
- **Invariant 273**: Win rate calculation accurately computes $\frac{\text{Won Count}}{\text{Won Count} + \text{Lost Count}} \times 100$
- **Invariant 274**: Customer 360 aggregates cross-domain entities without data duplication
- **Invariant 275**: Multi-tenant isolation: CRM leads, opportunities, quotations, and activities are partitioned strictly by organizationId

---

## 4. Verification & Test Results

```text
Test Suites: 220 passed, 220 total
Tests:       1270 passed, 1270 total
Snapshots:   0 total
Time:        13.869 s
```

- **Backend API Build**: `pnpm --filter api build` → `nest build` passed with **0 errors**.
- **Frontend Web Build**: `pnpm --filter web build` → Next.js compiled `/crm` route with **0 errors**.
- **Automated Tests**: 220 test suites passed cleanly with **1,270 tests passing**.

---

## 5. Architectural Decision Records (ADRs)

- **ADR-099**: CRM Orchestration & Commercial Pipeline Architecture
- **ADR-100**: Lead Qualification & Atomic One-Click Conversion
- **ADR-101**: Opportunity Pipeline Staging & Weighted Revenue Forecasting
- **ADR-102**: Quotation Governance, Approval Gates & M28 Order Conversion
- **ADR-103**: Customer 360 Cross-Domain Read-Model Aggregation
- **Index**: Updated `docs/14-reference/DOC-24-ADR-Index.md`
