# ADR-129: Public API Platform Architecture

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M41

## Context

The Universal Business Operations SaaS platform requires an external-facing public API tier allowing external applications, partners, automated scripts, and third-party integrations to interact with platform features securely. Previously in M39, tenant API keys and outbound webhooks were established. M41 requires a standardized public API platform that formalizes API contracts, enforces fine-grained scopes, guarantees strict tenant isolation, and avoids duplicating domain services.

## Decision

1. **Re-use Existing M39 API Keys**: The platform does not introduce new API key tables or authentication mechanisms. It reuses the M39 `ApiKey` model (storing SHA-256 hashes and key prefixes) and validates incoming keys using a dedicated `ApiKeyAuthGuard`.
2. **Strict Multi-Tenancy**: An API key is immutably linked to exactly one `organizationId`. The guard binds this tenant context to the execution pipeline. Any attempt to provide a differing tenant identifier (e.g., via `X-Organization-Id`) triggers a security event log (`CROSS_TENANT_API_BREACH_ATTEMPT`) and is immediately rejected with HTTP 403 Forbidden.
3. **Dedicated Scope Enforcement**: Fine-grained authorization is evaluated per endpoint using `@RequireApiScopes(...)` and `ApiScopeGuard`. Tenants can grant restricted permissions (e.g. `accounting.read`, `crm.read`, `inventory.write`) or full tenant administration via `api.admin`.
4. **Contract Centralization**: Public `/api/v1` routes are registered in a centralized `ApiContractService` that manages endpoint metadata, parameters, request/response schemas, error taxonomy, and automated OpenAPI 3.0.3 specification compilation.
5. **No Domain Logic Duplication**: The developer platform controllers and services act as contract orchestrators and telemetry interceptors; all business logic remains inside existing domain modules (e.g., Accounting, Inventory, CRM).

## Consequences

- External developers consume predictable, versioned endpoints (`/api/v1/*`) with standard error envelopes.
- Keys cannot breach tenant isolation or access unauthorized scopes.
- Public APIs can be cataloged, tested, and audited in a unified Developer Portal.
