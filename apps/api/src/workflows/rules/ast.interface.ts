export type RuleOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'IN'
  | 'NOT_IN'
  | 'IS_NULL'
  | 'IS_NOT_NULL'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'BEFORE'
  | 'AFTER'
  | 'BETWEEN';

export interface PathOperand {
  path: string;
}

export interface ValueOperand {
  value: unknown;
}

export type Operand = RuleAstNode | PathOperand | ValueOperand;

export interface RuleAstNode {
  operator: RuleOperator;
  left?: Operand;
  right?: Operand;
  operands?: RuleAstNode[];
}

export interface RuleEvaluationContext {
  event?: Record<string, unknown>;
  tenant?: Record<string, unknown>;
  user?: Record<string, unknown>;
  workflow?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  variables?: Record<string, unknown>;
}

export interface RuleEvaluationTrace {
  operator: string;
  leftValue?: unknown;
  rightValue?: unknown;
  result: boolean;
  operandsTraces?: RuleEvaluationTrace[];
  durationUs: number;
}

export interface RuleEvaluationResult {
  result: boolean;
  trace: RuleEvaluationTrace;
  evaluatedAt: Date;
}
