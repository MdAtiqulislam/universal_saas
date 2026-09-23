import { Injectable, BadRequestException } from '@nestjs/common';
import { RuleAstNode, RuleOperator, Operand } from './ast.interface';

const MAX_AST_DEPTH = 10;
const MAX_OPERANDS = 50;
const MAX_PATH_LENGTH = 120;
const ALLOWED_ROOTS = new Set([
  'event',
  'tenant',
  'user',
  'workflow',
  'execution',
  'variables',
]);
const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);

const COMPARISON_OPERATORS = new Set<RuleOperator>([
  'EQUALS',
  'NOT_EQUALS',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'CONTAINS',
  'NOT_CONTAINS',
  'IN',
  'NOT_IN',
  'STARTS_WITH',
  'ENDS_WITH',
  'BEFORE',
  'AFTER',
  'BETWEEN',
]);

const LOGICAL_OPERATORS = new Set<RuleOperator>(['AND', 'OR', 'NOT']);
const UNARY_OPERATORS = new Set<RuleOperator>(['IS_NULL', 'IS_NOT_NULL']);

@Injectable()
export class RuleValidatorService {
  validate(ast: unknown): RuleAstNode {
    if (!ast || typeof ast !== 'object') {
      throw new BadRequestException('Rule AST must be a non-null JSON object');
    }

    let nodeCount = 0;

    const validateNode = (node: unknown, depth: number): RuleAstNode => {
      if (depth > MAX_AST_DEPTH) {
        throw new BadRequestException(
          `Rule AST exceeds maximum depth of ${MAX_AST_DEPTH}`,
        );
      }
      nodeCount++;
      if (nodeCount > MAX_OPERANDS) {
        throw new BadRequestException(
          `Rule AST exceeds maximum operand limit of ${MAX_OPERANDS}`,
        );
      }

      if (!node || typeof node !== 'object') {
        throw new BadRequestException('Malformed AST node: must be an object');
      }

      const { operator, left, right, operands } = node as Record<
        string,
        unknown
      >;

      if (typeof operator !== 'string') {
        throw new BadRequestException(
          'AST node is missing required string property: operator',
        );
      }

      const op = operator as RuleOperator;

      if (LOGICAL_OPERATORS.has(op)) {
        if (!Array.isArray(operands) || operands.length === 0) {
          throw new BadRequestException(
            `Logical operator ${op} requires a non-empty array of operands`,
          );
        }
        if (op === 'NOT' && operands.length !== 1) {
          throw new BadRequestException(
            'Logical operator NOT requires exactly 1 operand',
          );
        }
        const validatedOperands = operands.map((child) =>
          validateNode(child, depth + 1),
        );
        return {
          operator: op,
          operands: validatedOperands,
        };
      }

      if (UNARY_OPERATORS.has(op)) {
        if (!left) {
          throw new BadRequestException(
            `Unary operator ${op} requires a left operand`,
          );
        }
        return {
          operator: op,
          left: this.validateOperand(left, depth + 1),
        };
      }

      if (COMPARISON_OPERATORS.has(op)) {
        if (!left || right === undefined) {
          throw new BadRequestException(
            `Comparison operator ${op} requires both left and right operands`,
          );
        }
        return {
          operator: op,
          left: this.validateOperand(left, depth + 1),
          right: this.validateOperand(right, depth + 1),
        };
      }

      throw new BadRequestException(`Unsupported rule operator: ${operator}`);
    };

    return validateNode(ast, 1);
  }

  private validateOperand(operand: unknown, depth: number): Operand {
    if (depth > MAX_AST_DEPTH) {
      throw new BadRequestException(
        `Rule AST exceeds maximum depth of ${MAX_AST_DEPTH}`,
      );
    }
    if (!operand || typeof operand !== 'object') {
      throw new BadRequestException(
        'Operand must be an object with path, value, or sub-expression',
      );
    }

    const opObj = operand as Record<string, unknown>;

    if ('operator' in opObj) {
      return this.validate(opObj);
    }

    if ('path' in opObj) {
      if (typeof opObj.path !== 'string') {
        throw new BadRequestException('Operand path must be a string');
      }
      this.validatePath(opObj.path);
      return { path: opObj.path };
    }

    if ('value' in opObj) {
      return { value: opObj.value };
    }

    throw new BadRequestException(
      'Operand must define either path, value, or sub-expression',
    );
  }

  private validatePath(path: string): void {
    if (path.length > MAX_PATH_LENGTH) {
      throw new BadRequestException(
        `Path "${path}" exceeds maximum length of ${MAX_PATH_LENGTH}`,
      );
    }

    const parts = path.split('.');
    if (parts.length === 0 || !ALLOWED_ROOTS.has(parts[0])) {
      throw new BadRequestException(
        `Path "${path}" must begin with one of allowed root prefixes: ${Array.from(ALLOWED_ROOTS).join(', ')}`,
      );
    }

    for (const part of parts) {
      if (FORBIDDEN_PROPERTIES.has(part)) {
        throw new BadRequestException(
          `Forbidden property access in path: ${part}`,
        );
      }
    }
  }
}
