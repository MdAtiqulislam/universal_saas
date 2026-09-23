# ADR-131: Developer Portal and API Explorer Security Architecture

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M41

## Context

Interactive API explorers inside developer portals can introduce significant security risks, notably Server-Side Request Forgery (SSRF), privilege escalation, arbitrary network requests, and accidental cross-tenant data modification if unconstrained.

## Decision

1. **Zero SSRF by Design**: The API Explorer never accepts arbitrary URLs or dispatches unvalidated outbound network calls.
2. **Registry-Constrained Execution**: The `ApiExplorerService` executes requests strictly against pre-registered, contract-validated public endpoints identified by `endpointId` in `ApiContractService`. Any request targeting an unregistered endpoint is rejected with HTTP 400.
3. **Internal Pipeline Delegation**: Test executions occur in-process or via loopback using predefined route handlers within the caller's verified tenant context (`organizationId`).
4. **Tenant Isolation Guarantees**: Even if an explorer request payload or header attempts to specify another organization, the execution sandbox overrides or strips it, enforcing the tenant boundary of the authenticated portal session or API key.
5. **Safe Method Verification**: State-mutating requests (POST, PUT, DELETE) executed in the Explorer require the user to hold explicit developer permissions (`developer.explorer.execute`), preventing unauthorized testers from tampering with operational tenant data.

## Consequences

- Third-party and in-house developers can safely explore and dry-run API contracts directly from the UI.
- SSRF and internal infrastructure probing attacks are structurally eliminated.
