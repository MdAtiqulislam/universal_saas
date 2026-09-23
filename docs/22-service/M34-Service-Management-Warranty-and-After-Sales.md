# Milestone M34 — Service Management, Warranty & After-Sales Operations Foundation

## Overview

Milestone M34 establishes a production-grade, multi-tenant after-sales service and warranty management domain for the Universal Business Operations SaaS platform. It connects customer support intake, warranty validation, technician assignment, field & workshop repair orders, parts consumption, labor logging, quality inspection, proof-of-handover, customer invoicing, and executive service reporting.

---

## 1. Domain Entities & State Machines

### 1.1 Customer Installed Base (`CustomerAsset`)

- **Purpose**: Authoritative registry of customer-owned equipment, machines, or devices.
- **Separation**: Distinct from tenant internal company assets (M22 Fixed Assets).
- **Service Statuses**: `OPERATIONAL`, `UNDER_SERVICE`, `DECOMMISSIONED`, `SCRAPPED`.
- **Warranty Statuses**: `ACTIVE`, `EXPIRED`, `VOIDED`, `NOT_APPLICABLE`.

### 1.2 Warranty Engine (`WarrantyPolicy` & `CustomerAssetWarranty`)

- **Policy Parameters**: Duration (months), Coverage Type (`FULL`, `PARTS_ONLY`, `LABOR_ONLY`, `LIMITED`, `NONE`), boolean coverage flags, exclusions.
- **Contract Attachments**: Active contract terms with claim limit enforcement and claimed amount tracking.
- **Deterministic Engine**: `WarrantyEligibilityService.checkEligibility()` validates date ranges, contract statuses, and calculates remaining days.

### 1.3 Service Requests & Support Tickets

- **Request Lifecycle**: `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `TRIAGED` $\rightarrow$ `CONVERTED_TO_TICKET` $\rightarrow$ `CANCELLED` / `REJECTED`.
- **Ticket Lifecycle**: `OPEN` $\rightarrow$ `TRIAGED` $\rightarrow$ `ASSIGNED` $\rightarrow$ `IN_DIAGNOSIS` $\rightarrow$ `AWAITING_APPROVAL` $\rightarrow$ `APPROVED` $\rightarrow$ `IN_SERVICE` $\rightarrow$ `QUALITY_CHECK` $\rightarrow$ `COMPLETED` $\rightarrow$ `HANDED_OVER` $\rightarrow$ `CLOSED`.
- **SLA Tracking**: Automated deadline tracking for first response and resolution, with real-time status transitions (`ON_TRACK`, `AT_RISK`, `BREACHED`, `MET`).

### 1.4 Technical Diagnosis & Quotations

- **Diagnosis**: Captures diagnosis codes, observed symptoms, root cause, repair/replacement recommendations, and warranty coverage flag. Finalized records are immutable.
- **Estimates**: Multi-line quotations separating warranty-covered amounts from customer payable charges.

### 1.5 Service Work Order Execution

- **Order Lifecycle**: `DRAFT` $\rightarrow$ `RELEASED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `QUALITY_CHECK` $\rightarrow$ `COMPLETED` $\rightarrow$ `HANDED_OVER` $\rightarrow$ `CLOSED`.
- **Parts Management**: Reservation against warehouse stock (M09/M30), issuance with M19 cost layer consumption, and unused parts return.
- **Labor Tracking**: Technician work date, actual hours, billable hours, hourly rates, and internal cost rates.
- **Costing Breakdown**: Exact `Prisma.Decimal` calculation of total parts cost, labor cost, other cost, total cost, warranty cost, customer charge, and net service margin.

---

## 2. Upstream & Downstream Engine Integrations

1. **M05 RBAC**: Granular permissions (`service.*`) mapped to `ADMIN` and `VIEWER` roles.
2. **M06 Audit**: 26 service domain events subscribed and persisted by `AuditEventListener`.
3. **M07 Numbering**: Atomic PostgreSQL sequence generation for `CSA-`, `SR-`, `ST-`, `EST-`, and `SVO-`.
4. **M09 & M19 Inventory / COGS**: Real-time parts reservation and FIFO costing layers.
5. **M12 General Ledger**: Warranty repair costs posted via `AccountingPostingService`.
6. **M14 Accounts Receivable**: 1-click customer invoice generation for billable repairs.
7. **M31 Quality Management**: Automated `QualityInspectionLot` creation and completion gating.
8. **M32 Returns / RMA**: Seamless conversion from return dispositions (`REPAIR` / `REWORK`) to service orders.
9. **M33 Period Close**: Financial postings strictly adhere to fiscal period open state and lock protection.

---

## 3. Database Invariants (229–250)

All 22 new invariants (229–250) are verified in `apps/api/src/prisma/database-invariants.spec.ts`, bringing the complete suite of invariants to 250 passing tests.
