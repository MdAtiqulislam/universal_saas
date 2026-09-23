# ADR-043: Decoupled Tax Engine and Deterministic Rule Precedence

## Context

Across commerce workflows (Sales Orders, Customer Invoices, Purchase Orders, Supplier Invoices, Credit Notes, Debit Notes), tax calculations often need to accommodate varying rates based on geography, customer status, supplier agreements, and item categories. Embedding tax logic directly inside invoicing and order services creates tight coupling, increases regulatory risk, and makes international tax expansion fragile.

## Decision

1. **Decoupled Tax Module**: Create a standalone `tax/` module that encapsulates tax calculation, code management, rate scheduling, and rule matching.
2. **Deterministic Precedence Hierarchy**:
   - Level 1: Direct line-level tax code override (e.g. `ZERO_RATED` explicitly supplied).
   - Level 2: Specific matching Tax Rule (ordered by ascending `priority` integer, matching transaction type, customer/supplier, item/category, and jurisdiction).
   - Level 3: Tenant default active tax code.
3. **Exact Decimal Calculation**:
   - Exclusive Tax: $\text{Taxable Amount} = (\text{Qty} \times \text{Price}) - \text{Discount}$, $\text{Tax} = \text{Taxable} \times \text{Rate}$.
   - Inclusive Tax: $\text{Taxable Amount} = \frac{\text{Line Total}}{1 + \text{Rate}}$, $\text{Tax} = \text{Line Total} - \text{Taxable}$.
   - All arithmetic strictly executed via `Prisma.Decimal`.

## Consequences

- Single point of tax logic maintenance across the entire platform.
- Full auditability of why a specific tax code and rate were selected (`calculationSource` trace).
- Clean separation between core commercial transactions and tax compliance.
