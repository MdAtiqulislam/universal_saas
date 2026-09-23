# ADR-132: Public API Versioning, Lifecycle and Deprecation Policy

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M41

## Context

Public APIs require long-term stability and explicit change governance so external integrators are never broken by platform iterations. A formal lifecycle and deprecation policy is needed.

## Decision

1. **URI Path-Based Versioning**: All public endpoints are rooted under explicit version prefixes (e.g., `/api/v1/*`). Breaking schema changes require a new major version prefix (`/api/v2/*`).
2. **Backward-Compatible Enhancements**: Additive non-breaking changes (such as new optional request parameters or additional response envelope fields) are permitted within the current version.
3. **Explicit Lifecycle States**: Each API version is tracked with a lifecycle status:
   - `ACTIVE`: Current production standard, fully supported and maintained.
   - `DEPRECATED`: Still operational but scheduled for retirement. Responses include standard `Deprecation: true` and `Sunset: <date>` HTTP headers.
   - `SUNSET`: Decommissioned. Endpoint returns HTTP 410 Gone with migration documentation links.
4. **Minimum Deprecation Window**: A major version must remain in `DEPRECATED` status for a minimum of 180 days before retirement, giving partners adequate time to migrate.
5. **Developer Portal Transparency**: The Developer Portal's Versions panel dynamically displays lifecycle timelines, changelogs, migration guides, and current deprecation schedules.

## Consequences

- Breaking changes are introduced safely with zero surprise downtime for external partners.
- Integrators receive machine-readable and UI-driven sunset alerts.
