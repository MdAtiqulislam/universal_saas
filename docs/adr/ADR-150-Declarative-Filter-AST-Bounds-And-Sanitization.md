# ADR-150: Declarative Filter AST Bounds and Sanitization

## Status

Accepted

## Context

Ad-hoc analytics queries and saved reports require expressive filtering across domain fields (e.g. status, dates, amounts, foreign keys). Allowing raw SQL, arbitrary string conditions, or unbounded expressions creates catastrophic SQL injection vectors and ReDoS/CPU starvation vulnerabilities.

## Decision

We define a strictly typed, bounded **Declarative Filter Abstract Syntax Tree (AST)**:

1. **Bounded Complexity**:
   - `MAX_DEPTH = 5`: Prevents deeply nested recursion stacks.
   - `MAX_NODES = 20`: Prevents query complexity denial-of-service.
   - `MAX_STRING_LENGTH = 256`: Prevents oversized string payloads.
   - `MAX_COLLECTION_VALUES = 50`: Prevents massive `IN (...)` arrays.
2. **Catalog Field Allowlisting**: Every leaf node's `field` is validated against the dataset's `allowedFilterFields`. Uncatalogued fields are immediately rejected with `BadRequestException`.
3. **Restricted Operator Set**: Leaf nodes are constrained to 11 safe operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, `between`, `isNull`, `isNotNull`.
4. **Safe Prisma Where Compilation**: AST is compiled directly into structured Prisma query objects (`AND`, `OR`, `NOT`, `{ field: { in: [...] } }`). Zero string concatenation, zero raw SQL.

## Consequences

### Positive

- Immune to SQL injection and arbitrary code execution.
- Predictable query compilation time (< 1ms).
- Seamless JSON serialization for saving reports and transferring via REST API.

## Related Invariants

- `INV-503`: Zero Dynamic / Raw SQL Interpolation
- `INV-504`: Declarative Filter AST Bounds & Sanitization
