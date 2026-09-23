# ADR-011: Pricing Tiers & Monetary Representation Strategy

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Database Architect  
**Technical Milestone:** M08 — Item & Product Catalog Management

---

## Context & Problem Statement

Products and variants must support multiple pricing tiers (e.g. `RETAIL`, `WHOLESALE`, `DISTRIBUTOR`) across different currencies and quantity break thresholds.

Key challenges include:

1. Floating-point rounding errors in monetary amounts and quantities.
2. Targeting prices to either a base `Item` OR a specific `ItemVariant` without ambiguous double-assignments.
3. Ensuring only one default pricing tier exists per tenant at any time.

---

## Decision Drivers

1. **Financial Exactness:** Absolute protection against IEEE-754 binary floating-point precision loss.
2. **Mutual Exclusivity (XOR Target):** An `ItemPrice` must point to _either_ `item_id` _or_ `variant_id`, never both and never neither.
3. **Multi-Currency Binding:** Every pricing tier must link to a valid active global ISO currency.
4. **Idempotent Default Tier:** Support a single active default tier per tenant without duplicate default race conditions.

---

## Decision Outcome

**Chosen Option:** **High-Precision Decimal Pricing with Database-Enforced XOR Constraints & Partial Unique Index**.

### Technical Rules

1. **Decimal Precision:** Stored in PostgreSQL as `DECIMAL(18, 4)` for both `amount` and `min_quantity`. JavaScript floating-point representations are converted to Prisma `Decimal` instances.
2. **Database-Enforced XOR Target Constraint:**
   ```sql
   ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_target_xor" CHECK (
       ("item_id" IS NOT NULL AND "variant_id" IS NULL)
       OR
       ("item_id" IS NULL AND "variant_id" IS NOT NULL)
   );
   ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_positive_amount" CHECK ("amount" > 0);
   ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_positive_min_qty" CHECK ("min_quantity" > 0);
   ```
3. **Partial Unique Index for Default Tier:**
   ```sql
   CREATE UNIQUE INDEX "pricing_tiers_org_default_idx" ON "pricing_tiers"("organization_id")
   WHERE "is_default" = true AND "is_active" = true;
   ```
4. **Default Tier Management:** Setting a tier as default automatically unsets the default status of any other tier for that tenant within a transactional boundary.

### Positive Consequences

- Zero ambiguity in price resolution between parent items and child variants.
- Deterministic monetary calculations.
- Hard relational guarantees against invalid negative amounts or multiple active default tiers.
