# ADR-125: Workflow Graph Validation and Deterministic Execution

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M40

## Context

Workflow definitions are represented as directed acyclic and cyclic graphs (DAGs/DCGs) of heterogeneous nodes (`START`, `CONDITION`, `ACTION`, `APPROVAL`, `PARALLEL`, `JOIN`, `DELAY`, `END`). Malformed topologies with orphaned nodes, missing start/end nodes, disconnected branches, or infinite execution loops threaten platform reliability.

## Decision

1. **Pre-Publication Graph Invariant Enforcement**:
   - Exactly one `START` node per version (INV-384).
   - At least one reachable `END` node from `START` (INV-385).
   - Zero orphaned nodes: every node except `START` must have incoming edges, and every node except `END` must have outgoing edges (INV-386).
   - Every edge must reference valid, existing nodes in the same version (INV-387).
2. **Terminal State Immutability**:
   - Once an execution reaches a terminal status (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`), its status cannot be modified back to `RUNNING` or `WAITING` (INV-394).
3. **Execution Safety Limits**:
   - A hard ceiling of 100 node transitions (`MAX_NODE_TRANSITIONS`) prevents runaway infinite loops. Executions exceeding this threshold fail deterministically with `MAX_TRANSITIONS_EXCEEDED`.
4. **Resumable Long-Running Steps**:
   - `APPROVAL` and `DELAY` nodes transition the execution into a non-blocking `WAITING` status, persisting execution context until resumed via approval event or scheduled timer.

## Consequences

- Workflows cannot be published or run if graph invariants fail validation.
- Infinite loops and deadlocks are impossible.
- Execution steps maintain an immutable sequential audit record of transitions.
