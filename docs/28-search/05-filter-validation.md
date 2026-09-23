# 05 — Filter Validation & Security Controls

## Defensive Validation Rules

The `FilterAstEngineService` enforces strict bounds before any query is parsed or evaluated:

1. **Allowlisted Filter Fields (`INV-480`)**:
   - Filter fields must match known searchable/filterable fields on the target resource.
   - Non-existent or internal database columns (e.g. password hashes, audit metadata) trigger immediate `BadRequestException`.
2. **Type-Compatible Operators (`INV-481`)**:
   - `STRING`: `eq`, `neq`, `contains`, `startsWith`, `endsWith`, `in`, `not_in`, `is_null`, `is_not_null`
   - `NUMBER`: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `not_in`, `is_null`, `is_not_null`
   - `BOOLEAN`: `eq`, `neq`, `is_null`, `is_not_null`
   - `DATE`: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `is_null`, `is_not_null`
   - `ENUM`: `eq`, `neq`, `in`, `not_in`, `is_null`, `is_not_null`
3. **Bounded AST Depth and Size (`INV-482`)**:
   - `maxDepth = 5`: Nested logical groups cannot exceed 5 levels deep.
   - `maxNodes = 20`: An AST expression cannot exceed 20 condition nodes in total.
4. **Bounded Value Sizes (`INV-483`)**:
   - `maxStringLength = 256`: String literals are capped at 256 characters to prevent ReDoS and memory bloat.
   - `maxArrayLength = 50`: Array values for `IN` / `NOT_IN` operators are capped at 50 items.
