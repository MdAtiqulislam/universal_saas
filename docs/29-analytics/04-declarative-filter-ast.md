# Declarative Filter AST

## Syntax & Node Structure

The analytics query engine accepts an abstract syntax tree representing boolean filtering expressions:

- **Leaf Node**: `{ field: string, operator: FilterOperator, value: unknown }`
- **Compound AND**: `{ and: FilterNode[] }`
- **Compound OR**: `{ or: FilterNode[] }`
- **Unary NOT**: `{ not: FilterNode }`

## Complexity Bounds

- `MAX_DEPTH = 5`
- `MAX_NODES = 20`
- `MAX_STRING_LENGTH = 256`
- `MAX_COLLECTION_VALUES = 50`

## Supported Operators

`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, `between`, `isNull`, `isNotNull`.
All operators translate directly into Prisma where clauses without raw SQL.
