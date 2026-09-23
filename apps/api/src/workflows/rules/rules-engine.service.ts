import { Injectable, BadRequestException } from '@nestjs/common';
import {
  RuleAstNode,
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleEvaluationTrace,
  Operand,
} from './ast.interface';
import { RuleValidatorService } from './rule-validator.service';

const MAX_EVALUATION_TIME_MS = 50;

@Injectable()
export class RulesEngineService {
  constructor(private readonly validator: RuleValidatorService) {}

  evaluate(
    ast: unknown,
    context: RuleEvaluationContext = {},
  ): RuleEvaluationResult {
    const validatedNode = this.validator.validate(ast);
    const startTime = Date.now();
    const trace: RuleEvaluationTrace = {
      operator: validatedNode.operator,
      result: false,
      durationUs: 0,
    };

    const result = this.evalNode(validatedNode, context, trace, startTime);
    trace.result = result;

    return {
      result,
      trace,
      evaluatedAt: new Date(),
    };
  }

  private evalNode(
    node: RuleAstNode,
    context: RuleEvaluationContext,
    trace: RuleEvaluationTrace,
    startTime: number,
  ): boolean {
    if (Date.now() - startTime > MAX_EVALUATION_TIME_MS) {
      throw new BadRequestException(
        'Rule evaluation exceeded maximum execution time',
      );
    }

    const t0 = process.hrtime.bigint();

    let res = false;
    switch (node.operator) {
      case 'AND': {
        trace.operandsTraces = [];
        res = true;
        for (const child of node.operands || []) {
          const childTrace: RuleEvaluationTrace = {
            operator: child.operator,
            result: false,
            durationUs: 0,
          };
          trace.operandsTraces.push(childTrace);
          const childRes = this.evalNode(child, context, childTrace, startTime);
          childTrace.result = childRes;
          if (!childRes) {
            res = false;
            break; // Short circuit
          }
        }
        break;
      }

      case 'OR': {
        trace.operandsTraces = [];
        res = false;
        for (const child of node.operands || []) {
          const childTrace: RuleEvaluationTrace = {
            operator: child.operator,
            result: false,
            durationUs: 0,
          };
          trace.operandsTraces.push(childTrace);
          const childRes = this.evalNode(child, context, childTrace, startTime);
          childTrace.result = childRes;
          if (childRes) {
            res = true;
            break; // Short circuit
          }
        }
        break;
      }

      case 'NOT': {
        trace.operandsTraces = [];
        const child = (node.operands || [])[0];
        if (!child) {
          res = false;
        } else {
          const childTrace: RuleEvaluationTrace = {
            operator: child.operator,
            result: false,
            durationUs: 0,
          };
          trace.operandsTraces.push(childTrace);
          const childRes = this.evalNode(child, context, childTrace, startTime);
          childTrace.result = childRes;
          res = !childRes;
        }
        break;
      }

      case 'IS_NULL': {
        const val = this.resolveOperand(node.left!, context, startTime);
        trace.leftValue = val;
        res = val === null || val === undefined;
        break;
      }

      case 'IS_NOT_NULL': {
        const val = this.resolveOperand(node.left!, context, startTime);
        trace.leftValue = val;
        res = val !== null && val !== undefined;
        break;
      }

      default: {
        const leftVal = this.resolveOperand(node.left!, context, startTime);
        const rightVal = this.resolveOperand(node.right!, context, startTime);
        trace.leftValue = leftVal;
        trace.rightValue = rightVal;
        res = this.evalBinary(node.operator, leftVal, rightVal);
        break;
      }
    }

    const t1 = process.hrtime.bigint();
    trace.durationUs = Number((t1 - t0) / 1000n);
    trace.result = res;
    return res;
  }

  private resolveOperand(
    operand: Operand,
    context: RuleEvaluationContext,
    startTime: number,
  ): unknown {
    if ('operator' in operand) {
      const subTrace: RuleEvaluationTrace = {
        operator: operand.operator,
        result: false,
        durationUs: 0,
      };
      return this.evalNode(operand, context, subTrace, startTime);
    }
    if ('path' in operand) {
      return this.resolvePath(operand.path, context);
    }
    if ('value' in operand) {
      return operand.value;
    }
    return undefined;
  }

  private resolvePath(path: string, context: RuleEvaluationContext): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== 'object'
      ) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private evalBinary(operator: string, left: unknown, right: unknown): boolean {
    switch (operator) {
      case 'EQUALS':
        return this.isEqual(left, right);

      case 'NOT_EQUALS':
        return !this.isEqual(left, right);

      case 'GREATER_THAN':
        return this.compare(left, right) > 0;

      case 'GREATER_THAN_OR_EQUAL':
        return this.compare(left, right) >= 0;

      case 'LESS_THAN':
        return this.compare(left, right) < 0;

      case 'LESS_THAN_OR_EQUAL':
        return this.compare(left, right) <= 0;

      case 'CONTAINS':
        if (typeof left === 'string' && typeof right === 'string') {
          return left.includes(right);
        }
        if (Array.isArray(left)) {
          return left.some((item) => this.isEqual(item, right));
        }
        return false;

      case 'NOT_CONTAINS':
        if (typeof left === 'string' && typeof right === 'string') {
          return !left.includes(right);
        }
        if (Array.isArray(left)) {
          return !left.some((item) => this.isEqual(item, right));
        }
        return false;

      case 'IN':
        if (Array.isArray(right)) {
          return right.some((item) => this.isEqual(item, left));
        }
        return false;

      case 'NOT_IN':
        if (Array.isArray(right)) {
          return !right.some((item) => this.isEqual(item, left));
        }
        return true;

      case 'STARTS_WITH':
        return (
          typeof left === 'string' &&
          typeof right === 'string' &&
          left.startsWith(right)
        );

      case 'ENDS_WITH':
        return (
          typeof left === 'string' &&
          typeof right === 'string' &&
          left.endsWith(right)
        );

      case 'BEFORE': {
        const dL = this.toDate(left);
        const dR = this.toDate(right);
        return dL !== null && dR !== null && dL.getTime() < dR.getTime();
      }

      case 'AFTER': {
        const dL = this.toDate(left);
        const dR = this.toDate(right);
        return dL !== null && dR !== null && dL.getTime() > dR.getTime();
      }

      case 'BETWEEN': {
        if (!Array.isArray(right) || right.length !== 2) return false;
        const rightArr = right as unknown[];
        const low = rightArr[0];
        const high = rightArr[1];
        const dVal = this.toDate(left);
        const dLow = this.toDate(low);
        const dHigh = this.toDate(high);

        if (dVal && dLow && dHigh) {
          return (
            dVal.getTime() >= dLow.getTime() &&
            dVal.getTime() <= dHigh.getTime()
          );
        }

        const numVal = Number(left);
        const numLow = Number(low);
        const numHigh = Number(high);
        if (!isNaN(numVal) && !isNaN(numLow) && !isNaN(numHigh)) {
          return numVal >= numLow && numVal <= numHigh;
        }
        return false;
      }

      default:
        return false;
    }
  }

  private isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined)
      return a === b;

    const dateA = this.toDate(a);
    const dateB = this.toDate(b);
    if (dateA && dateB) {
      return dateA.getTime() === dateB.getTime();
    }

    if (typeof a === 'number' && typeof b === 'number') {
      return a === b;
    }

    if (typeof a === 'string' && typeof b === 'string') {
      return a === b;
    }

    if (typeof a === 'boolean' && typeof b === 'boolean') {
      return a === b;
    }

    if (typeof a === 'object' || typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return false;
  }

  private compare(a: unknown, b: unknown): number {
    const dateA = this.toDate(a);
    const dateB = this.toDate(b);
    if (dateA && dateB) {
      return dateA.getTime() - dateB.getTime();
    }

    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }

    return String(a).localeCompare(String(b));
  }

  private toDate(val: unknown): Date | null {
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'string' && val.length >= 10) {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
}
