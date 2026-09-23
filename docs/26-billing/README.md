# Milestone M42: SaaS Billing, Subscription, Entitlements & Usage Metering Foundation

Welcome to the comprehensive technical documentation for the SaaS Billing and Commercial Foundation of the Universal Business Operations SaaS monorepo.

## Documentation Index

1. **[01. System Overview & Architecture](01-overview.md)** — Architectural principles, domain boundaries, and multi-tenant isolation.
2. **[02. Plans & Pricing Catalog](02-plans-and-pricing.md)** — Catalog model, SHA-256 integrity snapshots, and versioning.
3. **[03. Subscription State Machine](03-subscriptions.md)** — Subscription lifecycle states, transitions, upgrades, proration, and cancellation.
4. **[04. Feature Entitlements](04-entitlements.md)** — Centralized entitlement enforcement, boolean checks, and numeric caps.
5. **[05. Usage Metering](05-usage-metering.md)** — Idempotent ingestion, event deduplication, and daily aggregations.
6. **[06. Quota Enforcement](06-quotas.md)** — Hard vs. soft limits and authorized overrides.
7. **[07. Invoicing Engine](07-invoices.md)** — Deterministic line items, credits, discounts, taxes, and finalization immutability.
8. **[08. Payment Records & Settlement](08-payments.md)** — Payment tracking, gateway references, and balance due calculations.
9. **[09. Payment Provider Abstraction](09-providers.md)** — Decoupled adapter architecture and sandbox provider.
10. **[10. Inbound Webhook Reconciliation](10-webhooks.md)** — Webhook ingestion, signature verification, and idempotency.
11. **[11. Billing Security & PCI Compliance](11-billing-security.md)** — Zero raw card data, AES-256-GCM encryption, and secret redaction.
12. **[12. Financial Reconciliation & Ledger](12-billing-reconciliation.md)** — Credit consumption, loss prevention, and accounting alignment.
13. **[13. Operational Commercial Reporting](13-billing-reporting.md)** — MRR, ARR, churn, invoice aging, and telemetry analytics.
