# 01 - Developer Platform Overview

## Architectural Mission

The Developer Platform (Milestone M41) establishes a secure, tenant-isolated public API consumption tier on top of the Universal Business Operations SaaS foundation. It allows third-party applications, partners, internal tooling, and client SDKs to interact with platform services through versioned REST contracts (`/api/v1/*`).

## Key Principles

1. **Reuse Existing M39 Foundation**: No redundant API key or webhook data models. M39 `ApiKey` and `WebhookSubscription` records serve as the identity and callback mechanisms.
2. **Strict Multi-Tenancy**: Every request authenticated via API key operates strictly within the bound `organizationId`. Cross-tenant header tampering is detected, logged to `SecurityEventsService`, and rejected with HTTP 403.
3. **Contract Transparency**: All public endpoints are cataloged in `ApiContractService`, providing programmatic introspection, live OpenAPI 3.0.3 generation, and interactive testing via the Developer Portal.
4. **Non-Blocking Observability**: Every external API invocation logs structured telemetry (`ApiUsageRecord`) and increments M38 platform metric counters without delaying client responses.
5. **Zero SSRF & Safe Exploration**: Interactive API invocation is strictly locked to registered internal routes, eliminating any possibility of server-side request forgery.

## Module Structure

```
apps/api/src/developer/
├── developer.module.ts
├── api-contract.service.ts
├── api-explorer.service.ts
├── api-usage.service.ts
├── developer-dashboard.service.ts
├── developer-export.service.ts
├── controllers/
│   ├── developer-dashboard.controller.ts
│   ├── developer-api.controller.ts
│   ├── developer-usage.controller.ts
│   ├── developer-errors.controller.ts
│   └── developer-docs.controller.ts
├── guards/
│   ├── api-key-auth.guard.ts
│   └── api-scope.guard.ts
├── interceptors/
│   └── api-usage.interceptor.ts
├── decorators/
│   └── require-api-scopes.decorator.ts
└── repositories/
    └── api-usage.repository.ts
```
