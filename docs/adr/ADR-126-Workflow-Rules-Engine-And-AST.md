# ADR-126: Declarative Rules Engine and Safe AST Evaluation

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M40

## Context

Workflow branching and trigger filtering require evaluating business criteria against execution payloads (e.g. order value thresholds, customer tiers, approval amounts). Permitting arbitrary code execution (`eval()`, dynamic scripting, shell execution) poses severe security, resource exhaustion, and remote code execution (RCE) hazards.

## Decision

1. **Zero Runtime Code Execution**:
   - Dynamic code execution (JavaScript `eval()`, `new Function()`, Python, shell, or raw SQL) is strictly prohibited.
   - All rules and filter conditions are modeled as declarative JSON Abstract Syntax Trees (AST) conforming to `WorkflowRuleAst`.
2. **Deterministic Operator Catalog**:
   - Supported operators are restricted to well-defined pure functions: comparisons (`EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `LESS_THAN`), boolean combinations (`AND`, `OR`, `NOT`), collections (`IN`, `NOT_IN`, `CONTAINS`), string matching (`STARTS_WITH`, `ENDS_WITH`, `MATCHES_REGEX`), date comparisons (`BEFORE`, `AFTER`), and null checks (`IS_NULL`, `IS_NOT_NULL`).
3. **AST Depth & Complexity Bounds**:
   - Maximum tree depth: 10 levels.
   - Maximum total nodes/operands: 50.
   - Prevents recursive stack overflows and compute exhaustion.
4. **Evaluation Sandboxing & Prototype Pollution Protection**:
   - Property resolution forbids unsafe keys (`__proto__`, `constructor`, `prototype`).
   - Strict 50ms evaluation timeout guard prevents ReDoS attacks.

## Consequences

- Business rules are deterministic, fully inspectable, safe to store and serialize, and completely immune to arbitrary code injection.
- Rules can be modeled visually in the UI and executed safely in any multi-tenant environment.
