# 04 — Query Language Specification

## AST Query Grammar

The search filter engine supports a declarative Abstract Syntax Tree (AST) representation composed of recursive nodes.

```typescript
export type FilterNode = FieldConditionDto | LogicalGroupDto;

export interface FieldConditionDto {
  field: string;
  operator: FilterOperator;
  value?: unknown;
  secondaryValue?: unknown;
}

export interface LogicalGroupDto {
  logicalOperator: LogicalOperator;
  conditions: FilterNode[];
}
```

## Operators

- `EQUALS` (`eq`): Case-insensitive exact match
- `NOT_EQUALS` (`neq`): Case-insensitive inequality
- `CONTAINS` (`contains`): Case-insensitive substring match
- `STARTS_WITH` (`startsWith`): Prefix match
- `ENDS_WITH` (`endsWith`): Suffix match
- `GREATER_THAN` (`gt`): Numeric/Date greater than
- `GREATER_THAN_OR_EQUAL` (`gte`): Numeric/Date greater than or equal
- `LESS_THAN` (`lt`): Numeric/Date less than
- `LESS_THAN_OR_EQUAL` (`lte`): Numeric/Date less than or equal
- `BETWEEN` (`between`): Inclusive range check between `value` and `secondaryValue`
- `IN` (`in`): Array membership check
- `NOT_IN` (`not_in`): Array non-membership check
- `IS_NULL` (`is_null`): Null / undefined check
- `IS_NOT_NULL` (`is_not_null`): Defined / non-null check

## Example AST Payload

```json
{
  "logicalOperator": "AND",
  "conditions": [
    {
      "field": "status",
      "operator": "eq",
      "value": "ACTIVE"
    },
    {
      "logicalOperator": "OR",
      "conditions": [
        {
          "field": "amount",
          "operator": "gt",
          "value": 10000
        },
        {
          "field": "isPriority",
          "operator": "eq",
          "value": true
        }
      ]
    }
  ]
}
```
