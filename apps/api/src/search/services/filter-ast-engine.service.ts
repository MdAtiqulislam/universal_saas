import { Injectable, BadRequestException } from '@nestjs/common';
import {
  FilterNode,
  FilterOperator,
  LogicalOperator,
} from '../dto/filter-ast.dto';

export type FieldDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'ENUM';

export interface FieldDefinition {
  field: string;
  type: FieldDataType;
}

@Injectable()
export class FilterAstEngineService {
  private readonly maxDepth = 5;
  private readonly maxNodes = 20;
  private readonly maxStringLength = 256;
  private readonly maxArrayLength = 50;

  private readonly operatorCompatibility: Record<
    FieldDataType,
    FilterOperator[]
  > = {
    STRING: [
      FilterOperator.EQUALS,
      FilterOperator.NOT_EQUALS,
      FilterOperator.CONTAINS,
      FilterOperator.STARTS_WITH,
      FilterOperator.ENDS_WITH,
      FilterOperator.IN,
      FilterOperator.NOT_IN,
      FilterOperator.IS_NULL,
      FilterOperator.IS_NOT_NULL,
    ],
    NUMBER: [
      FilterOperator.EQUALS,
      FilterOperator.NOT_EQUALS,
      FilterOperator.GREATER_THAN,
      FilterOperator.GREATER_THAN_OR_EQUAL,
      FilterOperator.LESS_THAN,
      FilterOperator.LESS_THAN_OR_EQUAL,
      FilterOperator.BETWEEN,
      FilterOperator.IN,
      FilterOperator.NOT_IN,
      FilterOperator.IS_NULL,
      FilterOperator.IS_NOT_NULL,
    ],
    BOOLEAN: [
      FilterOperator.EQUALS,
      FilterOperator.NOT_EQUALS,
      FilterOperator.IS_NULL,
      FilterOperator.IS_NOT_NULL,
    ],
    DATE: [
      FilterOperator.EQUALS,
      FilterOperator.NOT_EQUALS,
      FilterOperator.GREATER_THAN,
      FilterOperator.GREATER_THAN_OR_EQUAL,
      FilterOperator.LESS_THAN,
      FilterOperator.LESS_THAN_OR_EQUAL,
      FilterOperator.BETWEEN,
      FilterOperator.IS_NULL,
      FilterOperator.IS_NOT_NULL,
    ],
    ENUM: [
      FilterOperator.EQUALS,
      FilterOperator.NOT_EQUALS,
      FilterOperator.IN,
      FilterOperator.NOT_IN,
      FilterOperator.IS_NULL,
      FilterOperator.IS_NOT_NULL,
    ],
  };

  /**
   * Validates filter AST compliance with INV-480, INV-481, INV-482, INV-483
   */
  validateAst(
    node: FilterNode,
    allowedFields?: FieldDefinition[] | string[],
  ): { nodeCount: number; maxDepth: number } {
    let nodeCount = 0;

    const allowedMap = new Map<string, FieldDataType>();
    if (allowedFields) {
      for (const f of allowedFields) {
        if (typeof f === 'string') {
          allowedMap.set(f, 'STRING');
        } else {
          allowedMap.set(f.field, f.type);
        }
      }
    }

    const traverse = (currentNode: FilterNode, depth: number): number => {
      nodeCount++;
      if (nodeCount > this.maxNodes) {
        throw new BadRequestException(
          `Filter expression exceeds maximum allowed nodes (${this.maxNodes}) (INV-482)`,
        );
      }
      if (depth > this.maxDepth) {
        throw new BadRequestException(
          `Filter expression exceeds maximum allowed depth (${this.maxDepth}) (INV-482)`,
        );
      }

      if ('logicalOperator' in currentNode) {
        const group = currentNode;
        if (
          !group.conditions ||
          !Array.isArray(group.conditions) ||
          group.conditions.length === 0
        ) {
          throw new BadRequestException(
            'Logical group must contain at least one condition',
          );
        }
        let deepest = depth;
        for (const child of group.conditions) {
          const childDepth = traverse(child, depth + 1);
          if (childDepth > deepest) deepest = childDepth;
        }
        return deepest;
      } else {
        const cond = currentNode;
        // INV-480: Search filter fields must belong to selected searchable resource
        if (allowedFields && !allowedMap.has(cond.field)) {
          throw new BadRequestException(
            `Filter field '${cond.field}' is not allowed for this resource (INV-480)`,
          );
        }

        // INV-481: Search operators must be valid for the selected field type
        const fieldType = allowedMap.get(cond.field) || 'STRING';
        const allowedOps = this.operatorCompatibility[fieldType];
        if (allowedOps && !allowedOps.includes(cond.operator)) {
          throw new BadRequestException(
            `Operator '${cond.operator}' is not valid for field '${cond.field}' of type '${fieldType}' (INV-481)`,
          );
        }

        // INV-483: Value length and value list bounds
        this.validateValueBounds(cond.value);
        if (cond.secondaryValue !== undefined) {
          this.validateValueBounds(cond.secondaryValue);
        }

        return depth;
      }
    };

    const maxDepthReached = traverse(node, 1);
    return { nodeCount, maxDepth: maxDepthReached };
  }

  private validateValueBounds(val: unknown): void {
    if (typeof val === 'string' && val.length > this.maxStringLength) {
      throw new BadRequestException(
        `Filter value exceeds maximum string length of ${this.maxStringLength} characters (INV-483)`,
      );
    }
    if (Array.isArray(val) && val.length > this.maxArrayLength) {
      throw new BadRequestException(
        `Filter array value exceeds maximum limit of ${this.maxArrayLength} elements (INV-483)`,
      );
    }
  }

  /**
   * Safely evaluates a record against the filter AST in memory (zero eval, zero Function)
   */
  evaluate(record: Record<string, unknown>, node?: FilterNode): boolean {
    if (!node) return true;

    if ('logicalOperator' in node) {
      const group = node;
      if (group.logicalOperator === LogicalOperator.AND) {
        return group.conditions.every((child) => this.evaluate(record, child));
      }
      if (group.logicalOperator === LogicalOperator.OR) {
        return group.conditions.some((child) => this.evaluate(record, child));
      }
      if (group.logicalOperator === LogicalOperator.NOT) {
        return !group.conditions.some((child) => this.evaluate(record, child));
      }
      return true;
    }

    const cond = node;
    const actual = record[cond.field];

    return this.evaluateCondition(
      actual,
      cond.operator,
      cond.value,
      cond.secondaryValue,
    );
  }

  private safeString(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (val instanceof Date) return val.toISOString();
    return JSON.stringify(val);
  }

  private evaluateCondition(
    actual: unknown,
    op: FilterOperator,
    expected?: unknown,
    secondaryExpected?: unknown,
  ): boolean {
    const actStr = this.safeString(actual).toLowerCase();
    const expStr = this.safeString(expected).toLowerCase();

    switch (op) {
      case FilterOperator.IS_NULL:
        return actual === null || actual === undefined;
      case FilterOperator.IS_NOT_NULL:
        return actual !== null && actual !== undefined;
      case FilterOperator.EQUALS:
        return actStr === expStr;
      case FilterOperator.NOT_EQUALS:
        return actStr !== expStr;
      case FilterOperator.CONTAINS:
        return actStr.includes(expStr);
      case FilterOperator.STARTS_WITH:
        return actStr.startsWith(expStr);
      case FilterOperator.ENDS_WITH:
        return actStr.endsWith(expStr);
      case FilterOperator.GREATER_THAN:
        return Number(actual) > Number(expected);
      case FilterOperator.GREATER_THAN_OR_EQUAL:
        return Number(actual) >= Number(expected);
      case FilterOperator.LESS_THAN:
        return Number(actual) < Number(expected);
      case FilterOperator.LESS_THAN_OR_EQUAL:
        return Number(actual) <= Number(expected);
      case FilterOperator.BETWEEN: {
        const n = Number(actual);
        return n >= Number(expected) && n <= Number(secondaryExpected);
      }
      case FilterOperator.IN:
        if (!Array.isArray(expected)) return false;
        return expected.some(
          (v) => this.safeString(v).toLowerCase() === actStr,
        );
      case FilterOperator.NOT_IN:
        if (!Array.isArray(expected)) return true;
        return !expected.some(
          (v) => this.safeString(v).toLowerCase() === actStr,
        );
      default:
        return true;
    }
  }
}
