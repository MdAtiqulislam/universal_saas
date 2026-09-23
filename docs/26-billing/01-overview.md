# 01. System Overview & Architecture

## Mission & Purpose

Milestone M42 transforms the Universal Business Operations SaaS monorepo into a commercially monetizable, enterprise-grade multi-tenant platform. It provides a complete subscription lifecycle engine, immutable pricing versions, feature entitlements, consumption metering, invoice generation, credit ledgers, and payment provider abstraction.

## Core Architectural Invariants

- **Lossless Minor-Unit Arithmetic**: Every monetary value is stored and calculated as an integer representing the smallest minor unit of the target currency (e.g. cents for USD/EUR). No floating-point math is used.
- **Strict Multi-Tenant Isolation**: Every commercial entity belongs to exactly one `organizationId`. Cross-tenant queries are blocked fail-safe with HTTP 403 `ForbiddenException`.
- **Decoupled Gateway Layer**: Gateway SDKs (Stripe, Paddle, etc.) are abstracted behind a unified `BillingProviderAdapter` interface, keeping the core domain completely independent of external dependencies.
- **Auditing & Event Publishing**: All lifecycle events (plan publishing, subscription state transitions, invoice finalization, payments) record immutable audit logs via `AuditService` and publish asynchronous events via `EventBusService`.
