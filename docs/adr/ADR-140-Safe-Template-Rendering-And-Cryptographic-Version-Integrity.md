# ADR-140: Safe Template Rendering and Cryptographic Version Integrity

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M43

## Context

User-defined and system notification templates often include dynamic variables (e.g., recipient names, invoice amounts, URLs). Employing standard templating engines or `eval`-like constructs introduces severe Server-Side Template Injection (SSTI) and Remote Code Execution (RCE) vulnerabilities. Additionally, changes to templates in production must preserve historical fidelity for past dispatches and legal audits.

## Decision

1. **Zero-Code Execution Engine (`INV-457`)**:
   - The `TemplateEngineService` strictly disallows executable code, script tags, and arbitrary expression evaluation.
   - Variable substitution utilizes double curly syntax (`{{variable.path}}`) backed by a pure RegExp resolver.
   - Only allowlisted alphanumeric dot-path identifiers matching `/^[a-zA-Z0-9_.]+$/` are permitted.
2. **Deterministic Fallbacks**:
   - Undefined or null variable paths resolve cleanly to empty strings without throwing runtime errors or exposing internal object representations (`[object Object]`).
3. **Immutable Published Versions (`INV-458`)**:
   - Published template versions (`NotificationTemplateVersion`) are strictly immutable in the database. Any modification generates a new sequential version number.
4. **Cryptographic SHA-256 Snapshot Integrity (`INV-459`)**:
   - Each published version computes a canonical SHA-256 integrity hash over its normalized subject, body, and channels array. Dispatches verify this integrity hash prior to rendering.

## Consequences

- Completely eliminates template injection vulnerabilities across all communication channels.
- Full auditability: past communications reference immutable version snapshots with verifiable cryptographic fingerprints.
