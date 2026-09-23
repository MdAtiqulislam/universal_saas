# Developer Platform & Public API Documentation

This directory contains architectural and operational documentation for the Universal Business Operations SaaS Developer Platform (Milestone M41).

## Documentation Index

- **[01-overview.md](./01-overview.md)**: Public API platform architecture, routing principles, and high-level structure.
- **[02-authentication-and-scopes.md](./02-authentication-and-scopes.md)**: API Key authentication, SHA-256 validation, and granular scope system.
- **[03-api-explorer.md](./03-api-explorer.md)**: Interactive API Explorer, sandbox execution, and SSRF prevention architecture.
- **[04-telemetry-and-usage.md](./04-telemetry-and-usage.md)**: API usage tracking, IP hashing, duration calculation, and CSV export.
- **[05-versioning-and-lifecycle.md](./05-versioning-and-lifecycle.md)**: Path-based API versioning, lifecycle states (`ACTIVE`, `DEPRECATED`, `SUNSET`), and headers.
- **[06-sdk-and-contracts.md](./06-sdk-and-contracts.md)**: Dynamic OpenAPI 3.0.3 generation and SDK compilation foundation.
- **[07-error-handling.md](./07-error-handling.md)**: Standardized error envelopes, error code taxonomy, and troubleshooting.
- **[08-developer-portal-guide.md](./08-developer-portal-guide.md)**: User guide for the developer portal at `/admin/developer`.
- **[09-security-and-isolation.md](./09-security-and-isolation.md)**: Tenant isolation invariants, cross-tenant security defenses, and audit logging.

## Related ADRs

- **[ADR-129: Public API Platform Architecture](../adr/ADR-129-Public-Api-Platform-Architecture.md)**
- **[ADR-130: API Usage Telemetry, Privacy and Retention Strategy](../adr/ADR-130-Api-Usage-Telemetry-And-Retention.md)**
- **[ADR-131: Developer Portal and API Explorer Security Architecture](../adr/ADR-131-Developer-Portal-And-Api-Explorer-Security.md)**
- **[ADR-132: Public API Versioning, Lifecycle and Deprecation Policy](../adr/ADR-132-Public-Api-Versioning-And-Deprecation.md)**
- **[ADR-133: SDK and OpenAPI Contract Strategy](../adr/ADR-133-Sdk-And-OpenApi-Contract-Strategy.md)**
