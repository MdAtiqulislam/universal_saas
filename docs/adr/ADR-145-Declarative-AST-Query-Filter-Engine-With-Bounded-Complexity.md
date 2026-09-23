# ADR-145: Declarative AST Query Filter Engine with Bounded Complexity

**Status:** Accepted  
**Date:** 2026-09-11  
**Milestone:** M44

## Context

User interfaces and API consumers require filtering search records across diverse dimensions (status, amounts, dates, string prefixes). Allowing raw SQL, JavaScript expressions, or unbounded queries opens critical security vulnerabilities (SQL injection, AST resource exhaustion, ReDoS, denial of service).

## Decision

1. **Declarative Filter AST (`INV-480`, `INV-481`)**:
   - Represent filters as a strictly typed JSON AST composed of `FieldCondition` and `LogicalGroup` nodes with operators (`eq`, `neq`, `contains`, `startsWith`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `not_in`, `is_null`, `is_not_null`).
   - Validate every condition against an allowlist of permitted fields (`INV-480`) and ensure operators match the field's physical data type (`INV-481`).
2. **Zero Code Execution**:
   - Disallow `eval()`, `new Function()`, or dynamic raw SQL string interpolation. All AST evaluations are performed by pure TypeScript traversal functions.
3. **Strict Bounds Enforcement (`INV-482`, `INV-483`)**:
   - Enforce max AST tree depth: `depth <= 5`.
   - Enforce max total AST nodes: `nodes <= 20`.
   - Enforce max string value length: `length <= 256` characters.
   - Enforce max array size for `in` / `not_in` lists: `items <= 50`.

## Consequences

- Completely eliminates SQL injection and remote code execution vulnerabilities from user query filters.
- Predictable CPU and memory footprint even under adversarial filter trees.
- Consistent filtering semantics across both database queries and in-memory ranking pipelines.
