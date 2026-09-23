# Milestone M40: Workflow Automation, Rules Engine & Business Process Orchestration

## Executive Summary

Milestone M40 establishes a production-grade, multi-tenant workflow automation and business process orchestration foundation across all previously completed modules M01–M39 of the Universal Business Operations SaaS platform.

The system enables business analysts and platform administrators to visually and programmatically model, version, simulate, execute, approve, and monitor complex cross-domain workflows with strict tenant isolation, immutable versioning, declarative rules evaluation (zero runtime code execution), and end-to-end operational observability.

---

## Key Capabilities

### 1. Multi-Tenant Workflow Definition & Immutable Versioning

- **Workflow Definitions**: Scoped per organization with unique string keys (`INV-376`, `INV-377`). Supports categorization (`OPERATIONS`, `FINANCE`, `PROCUREMENT`, `SALES`, `HR`).
- **Version Lifecycle**: Definitions support multiple revisions. Versions transition from `DRAFT` to `PUBLISHED` to `RETIRED`.
- **Immutability (INV-380)**: Published workflow versions are strictly immutable, sealed with a SHA-256 integrity checksum snapshot. Active executions remain bound to their specific version snapshot.

### 2. Directed Workflow Graph & Pre-Publication Validation

- **Heterogeneous Node Graph**: Directed graph supporting `START`, `END`, `CONDITION`, `ACTION`, `APPROVAL`, `PARALLEL`, `JOIN`, `DELAY`, `SCHEDULE`, and `SUB_WORKFLOW` nodes (`INV-382`, `INV-383`).
- **Topological Invariant Enforcement**:
  - `INV-384`: Graph must have exactly one `START` node.
  - `INV-385`: Graph must have at least one reachable `END` node.
  - `INV-386`: Graph must have no orphaned nodes (all non-start nodes have in-edges, all non-end nodes have out-edges).
  - `INV-387`: All edges must reference valid source and target nodes within the same version.

### 3. Declarative Rules Engine (Zero Arbitrary Code Execution)

- **Declarative AST**: Rules are modeled as strict JSON Abstract Syntax Trees conforming to `WorkflowRuleAst` (`INV-390`).
- **Safety First**: Prohibits all dynamic code execution (`eval()`, JavaScript execution, Python, shell scripts, or raw SQL).
- **Supported Operators**:
  - Equality / Comparison: `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN`, `LESS_THAN_OR_EQUAL`.
  - Logic: `AND`, `OR`, `NOT`.
  - Collections: `IN`, `NOT_IN`, `CONTAINS`.
  - Strings: `STARTS_WITH`, `ENDS_WITH`, `MATCHES_REGEX`.
  - Time: `BEFORE`, `AFTER`.
  - Nullability: `IS_NULL`, `IS_NOT_NULL`.
- **Resource Constraints**: Maximum AST depth of 10 levels, maximum 50 operands, and 50ms evaluation timeout guard to prevent ReDoS and compute exhaustion (`INV-391`).

### 4. Multi-Trigger Orchestration

- **Event Triggers (INV-388, INV-389)**: Subscribes to platform integration events (e.g. `order.created`, `invoice.issued`, `inventory.low`) with optional AST filter rules.
- **Scheduled Triggers (INV-399)**: Automated cron and interval schedules with timezone support, last run/next run tracking, and concurrency protection.
- **Manual / API Triggers**: Direct execution dispatch via authenticated REST API with idempotency key deduplication (`INV-396`).

### 5. Deterministic Execution Engine & Step Auditing

- **Asynchronous Execution Pipeline**: Decoupled from incoming HTTP threads using M36 `JobService` (`WORKFLOW_EXECUTION`, `WORKFLOW_RESUME`).
- **State Machine**: Transitions from `PENDING` &rarr; `RUNNING` &rarr; `WAITING` (for approval or delay) &rarr; `COMPLETED` / `FAILED` / `CANCELLED` / `TIMED_OUT`.
- **Terminal Immutability (INV-394)**: Executions in terminal states cannot transition back to running.
- **Loop Protection**: Capped at 100 transitions per execution run to prevent infinite cycles.
- **Step Audit History (INV-395)**: Every node execution records attempt number, duration, input, output, and error traces.

### 6. Human Approval Orchestration & Delegation

- **Approver Targeting**: By user ID, role (e.g. `MANAGER`, `FINANCE_APPROVER`), manager, or organization owner (`INV-398`).
- **Quorum Schemes**: `ANY_ONE` (first approver decides), `ALL` (unanimous), `MINIMUM_COUNT` (quorum threshold).
- **Decision Integrity (INV-397)**: Rejections require mandatory justification reasons. Duplicate voting by the same actor is prevented by unique constraints.
- **Delegation & Escalation**: Approvers can delegate requests to peers. Overdue requests escalate automatically according to SLA rules.

### 7. Operational Telemetry & Reporting

- 10 operational reporting endpoints under `/api/v1/workflow-reports`:
  1. Overview: Definition and execution KPI summary
  2. Success/Failure: Status breakdown and failure rates
  3. Performance: P50, P95, and P99 latency percentiles
  4. Failures: Error codes and failure logs
  5. Approval Queue: Active pending approvals backlog
  6. Approval SLA: Resolution duration and SLA compliance
  7. Action Failures: Action execution errors and retries
  8. Rule Evaluations: Condition step statistics
  9. Schedules: Scheduled trigger history and drift
  10. Adoption: Utilization and volume by workflow category

---

## Database Invariants (INV-376 – INV-400)

| Invariant   | Description                                                                          |
| ----------- | ------------------------------------------------------------------------------------ |
| **INV-376** | WorkflowDefinition key must be unique per organization                               |
| **INV-377** | WorkflowDefinition cannot be accessed by another organization                        |
| **INV-378** | WorkflowVersion must belong to exactly one WorkflowDefinition                        |
| **INV-379** | WorkflowVersion version number must be strictly sequential and unique per definition |
| **INV-380** | Published WorkflowVersion is immutable (nodes, edges, config cannot be mutated)      |
| **INV-381** | Active version must reference a published WorkflowVersion of the same definition     |
| **INV-382** | WorkflowNode must belong to exactly one WorkflowVersion                              |
| **INV-383** | WorkflowNode cannot be shared across different WorkflowVersions                      |
| **INV-384** | Workflow graph must have exactly one START node                                      |
| **INV-385** | Workflow graph must have at least one reachable END node                             |
| **INV-386** | Workflow graph cannot have orphaned nodes                                            |
| **INV-387** | WorkflowEdge source and target nodes must exist within the same WorkflowVersion      |
| **INV-388** | WorkflowTrigger must belong to an active WorkflowDefinition                          |
| **INV-389** | Integration event trigger must reference a valid supported event type                |
| **INV-390** | WorkflowRule must have a valid AST and only supported operators                      |
| **INV-391** | Rule evaluation cannot exceed max AST depth (10) or operand limits (50)              |
| **INV-392** | WorkflowExecution must belong to the same organization as its WorkflowDefinition     |
| **INV-393** | WorkflowExecution must reference an immutable WorkflowVersion                        |
| **INV-394** | WorkflowExecution cannot transition from terminal state back to RUNNING              |
| **INV-395** | WorkflowExecutionStep must belong to exactly one WorkflowExecution                   |
| **INV-396** | Action cannot execute more than once for the same idempotency key                    |
| **INV-397** | Approval decision cannot be recorded twice for the same actor                        |
| **INV-398** | Only eligible approvers can approve or reject an approval request                    |
| **INV-399** | WorkflowSchedule unique concurrent execution prevention                              |
| **INV-400** | WorkflowExecutionLog entries are append-only and immutable                           |
