# ADR-124: Multi-Tenant Workflow Automation Platform Architecture

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M40

## Context

The Universal Business Operations SaaS platform requires an automated business process orchestration layer spanning M01–M39 modules (Finance, Inventory, Manufacturing, CRM, Approvals, Integrations). The orchestration engine must be multi-tenant, versioned, observable, and fully decoupled from underlying domain state machines without owning duplicate business ledgers.

## Decision

1. **Non-Duplication of Business Logic**: Workflows orchestrate actions via domain services and integration events. The workflow engine never stores business records, balances, or duplicate domain state.
2. **Strict Multi-Tenancy**: Every workflow definition, version, trigger, node, execution, step, and approval is scoped strictly by `organizationId`. Cross-tenant trigger invocation or execution inspection is prevented at database and service layers.
3. **Immutable Versioning**: Workflow definitions act as metadata containers (`WorkflowDefinition`). Active logic is executed exclusively against immutable, published snapshots (`WorkflowVersion`) verified by SHA-256 checksums.
4. **Decoupled Asynchronous Execution**: Workflow triggers enqueue execution tasks to M36 `JobService` (`WORKFLOW_EXECUTION`, `WORKFLOW_RESUME`). The execution interpreter transitions nodes asynchronously without blocking incoming HTTP threads.
5. **Full Observability & Audit**: Every execution mutation emits structured platform logs via M38 `StructuredLoggingService` and records audit entries via `AuditService`.

## Consequences

- Modifying an active workflow requires authoring a new version and publishing it. Existing executions continue executing their pinned version snapshot without race conditions.
- Zero cross-tenant data leakage is guaranteed across definition authoring, triggers, and runtime steps.
