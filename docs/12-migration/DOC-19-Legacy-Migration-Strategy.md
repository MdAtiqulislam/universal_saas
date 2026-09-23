# DOC-19: Legacy Visual FoxPro Migration Strategy

**Version:** 1.0 | **Status:** APPROVED | **Date:** 2026-08-27
**Purpose:** Approach to migrating data from the legacy VFP application.
**Owner:** Database Architect

## Legacy Assessment & Constraints

- Legacy database is Visual FoxPro. The new system uses PostgreSQL.
- **Assumption:** Legacy schema is completely different and likely denormalized. Do NOT assume mapping is 1:1.

## Migration Phases

1. **Data Extraction & Discovery:** Export VFP data to flat files (CSV) or staging DB. Profile data for anomalies.
2. **Data Cleansing & Transformation:** Scripted transformation mapping VFP concepts to SaaS concepts (e.g., global IDs to tenant-scoped entities).
3. **Master Data Migration:** Import Organizations, Users, Products, Suppliers, Warehouses.
4. **Transaction Migration:** Import historical Purchase, Issue, Stock, Shipment records.
5. **Reconciliation & Dry Run:** Validate balances and counts programmatically.

## Migration Scripts

- Must be repeatable (idempotent).
- Must utilize a Staging Environment for dry runs before production cutover.
