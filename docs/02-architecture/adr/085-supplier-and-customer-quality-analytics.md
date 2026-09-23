# ADR 085: Supplier & Customer Quality Intelligence & Analytics Engine

## Status

Accepted

## Context

Quality metrics must provide real-time visibility across the entire supply chain. Procurement teams require supplier rating scorecards to manage vendor performance and negotiate contracts, while sales and operations teams require customer quality tracking (RMAs, warranty defect rates) and 12 executive quality reports.

## Decision

1. **Supplier Quality Scorecards**:
   - `SupplierQualityService` aggregates inspection lots, rejection counts, failed sample quantities, NCRs, and purchase returns.
   - Calculates real-time metrics:
     - `lotRejectionRate = (rejectedLots / totalLots) * 100`
     - `defectRate = (failedQty / inspectedQty) * 100`
     - `qualityScore = max(0, 100 - (lotRejectionRate * 0.5) - (defectRate * 0.3) - (ncrCount * 5))`
   - Detailed vendor scorecards return aggregated summary statistics and recent inspection history.

2. **Customer Quality Issue Pipeline**:
   - `CustomerQualityService` tracks external customer complaints, packaging defects, and shipment RMA reasons (`CustomerQualityIssue`).
   - Links to customer records, sales orders, shipments, and internal NCRs for defect investigation and resolution.

3. **Real-Time 12 Quality Reports Engine**:
   - `QualityReportsService` provides 12 specialized analytical endpoints:
     1. `Inspection Summary` (pass rates, lot counts, inspected/passed/failed quantities).
     2. `Pass / Fail Rates by Item`.
     3. `Inspection Lot Aging` (buckets: <24h, 1-3d, 3-7d, >7d).
     4. `Quality Holds Report`.
     5. `Quarantine Aging Report`.
     6. `Non-Conformance (NCR) Summary by Severity & Status`.
     7. `NCR Aging Analysis`.
     8. `CAPA Status & Verification Aging`.
     9. `Supplier Quality Performance Report`.
     10. `Customer Quality Issues & Resolution Trends`.
     11. `Rework & Scrap Analysis`.
     12. `Monthly Quality Trends (Historical Pass Rate Evolution)`.

## Consequences

### Positive

- Actionable supply chain quality ratings enabling data-driven supplier evaluations.
- Complete customer feedback loop from complaint intake to product enhancement.
- Comprehensive operational intelligence across 12 standard quality dimensions.

### Negative

- High-volume reporting queries should leverage database indices on `organizationId`, `createdAt`, `status`, `decision`, and foreign keys.
