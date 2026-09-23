# ADR-134: Billing Domain Boundaries, Multi-Tenancy and Operational Decoupling

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M42

## Context

The Universal Business Operations SaaS platform requires an enterprise-grade commercial monetization layer encompassing subscriptions, pricing catalogs, feature entitlements, usage metering, invoicing, and payment processing. This commercial foundation must remain strictly decoupled from core operational domains (ERP, CRM, Manufacturing, Logistics, HR, Accounting) while providing centralized governance over tenant access, tier limits, and financial lifecycle states.

## Decision

1. **Domain Boundary Isolation**: The `BillingModule` operates as an independent commercial orchestration engine. Operational modules (e.g., inventory, sales, workflows) never manipulate subscriptions or invoices directly; instead, they consume entitlements via `EntitlementsService` and record metered events via `UsageMeteringService`.
2. **Tenant Isolation by Construction**:
   - Every commercial record (`BillingSubscription`, `BillingPeriod`, `BillingUsageRecord`, `BillingQuota`, `BillingInvoice`, `BillingCredit`, `BillingPayment`) is strictly tenant-scoped via non-nullable `organizationId` foreign keys and compound database indexes.
   - Cross-tenant access is rejected fail-safe with HTTP 403 `ForbiddenException`.
3. **Lossless Integer Monetary Arithmetic**: Floating-point numeric representations are completely prohibited for financial calculations. All monetary amounts (prices, taxes, discounts, credits, invoice subtotals, amounts due, and payment transactions) are strictly represented as non-negative integer minor units (e.g., USD cents, EUR cents).
4. **Platform Infrastructure Reuse**:
   - Reuses `AuditService` to write immutable tamper-evident records of all commercial mutations (plan publishing, subscription changes, trial extensions, invoice finalizations, credit grants).
   - Reuses `EventBusService` to broadcast domain events (`billing.subscription.created`, `billing.invoice.finalized`, `billing.payment.succeeded`) with complete error isolation.
   - Reuses `StructuredLoggingService` with automatic credential and PII redaction.

## Consequences

- The platform gains robust, auditor-compliant monetization capabilities with zero risk of cross-tenant data leakage.
- Operational domain logic remains clean and decoupled from pricing and billing mechanics.
- Financial arithmetic is guaranteed mathematically lossless across currencies and tax/discount calculations.
