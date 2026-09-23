# ADR-127: Human Approval Orchestration and Delegation

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M40

## Context

Many business processes require human decision-making prior to critical mutations (e.g. purchase order approvals, expense reimbursements, invoice sign-offs). The approval subsystem must support multi-approver schemes, quorum rules, auditability, delegation, deadline expiration, and escalation without causing race conditions or deadlocks.

## Decision

1. **Structured Approver Targeting**:
   - Approvals support multiple targeting modes (`USER`, `ROLE`, `MANAGER`, `OWNER`).
   - Eligibility is verified at decision time against the tenant organization's active membership and roles (INV-398).
2. **Multi-Decision Scheme**:
   - Supports `ANY_ONE` (first approver decides), `ALL` (unanimous), and `MINIMUM_COUNT` (quorum threshold).
   - Rejection by an authorized approver halts the approval step immediately and transitions the workflow along the rejection branch.
3. **Duplicate Decision Prevention (INV-397)**:
   - An actor cannot record more than one decision for the same approval request. Enforced via database unique constraint `@@unique([approvalId, actorUserId])`.
4. **Delegation & Escalation**:
   - Approvers may delegate pending requests to another eligible user in the same tenant. The delegator's ID is recorded for non-repudiation (`delegatedFromUserId`).
   - Automated SLA checks flag overdue requests and support escalation to designated escalation targets (`escalatedTo`).
5. **Execution Resumption**:
   - Once quorum or rejection is finalized, the approval service enqueues a `WORKFLOW_RESUME` background job to advance the waiting execution to the next node.

## Consequences

- Human approval flows are fully auditable, resistant to vote tampering, and decouple human response time from active system thread consumption.
