import {
  IsString,
  IsArray,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'contains'
  | 'between'
  | 'isNull'
  | 'isNotNull';

export interface FilterNode {
  field?: string;
  operator?: FilterOperator;
  value?: unknown;
  and?: FilterNode[];
  or?: FilterNode[];
  not?: FilterNode;
}

export class MeasureQueryItem {
  @IsString()
  name!: string;

  @IsIn(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'])
  aggregation!: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
}

export class AnalyticsQueryDto {
  @IsString()
  definitionKey!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dimensions?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeasureQueryItem)
  @IsOptional()
  measures?: MeasureQueryItem[];

  @IsObject()
  @IsOptional()
  filterAst?: FilterNode;

  @IsString()
  @IsOptional()
  timeDimension?: string;

  @IsIn(['hour', 'day', 'week', 'month', 'quarter', 'year'])
  @IsOptional()
  timeGranularity?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

  @IsString()
  @IsOptional()
  timeZone?: string = 'UTC';

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  limit?: number = 50;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortDirection?: 'asc' | 'desc' = 'asc';
}

export const AST_BOUNDS = {
  MAX_DEPTH: 5,
  MAX_NODES: 20,
  MAX_STRING_LENGTH: 256,
  MAX_COLLECTION_VALUES: 50,
  MAX_DIMENSIONS: 10,
  MAX_MEASURES: 20,
  MAX_GROUP_BY: 5,
} as const;

export class AstValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AstValidationError';
  }
}

export function validateFilterAst(
  node: FilterNode | undefined,
  allowedFields: string[],
  currentDepth = 1,
  nodeCounter = { count: 0 },
): void {
  if (!node) return;

  nodeCounter.count += 1;
  if (nodeCounter.count > AST_BOUNDS.MAX_NODES) {
    throw new AstValidationError(
      `Filter AST exceeds maximum allowed nodes (${AST_BOUNDS.MAX_NODES}) (INV-504)`,
    );
  }

  if (currentDepth > AST_BOUNDS.MAX_DEPTH) {
    throw new AstValidationError(
      `Filter AST exceeds maximum allowed depth (${AST_BOUNDS.MAX_DEPTH}) (INV-504)`,
    );
  }

  // Compound AND
  if (node.and) {
    if (!Array.isArray(node.and)) {
      throw new AstValidationError(
        'Filter "and" property must be an array (INV-504)',
      );
    }
    for (const child of node.and) {
      validateFilterAst(child, allowedFields, currentDepth + 1, nodeCounter);
    }
    return;
  }

  // Compound OR
  if (node.or) {
    if (!Array.isArray(node.or)) {
      throw new AstValidationError(
        'Filter "or" property must be an array (INV-504)',
      );
    }
    for (const child of node.or) {
      validateFilterAst(child, allowedFields, currentDepth + 1, nodeCounter);
    }
    return;
  }

  // Unary NOT
  if (node.not) {
    validateFilterAst(node.not, allowedFields, currentDepth + 1, nodeCounter);
    return;
  }

  // Leaf node
  if (!node.field) {
    throw new AstValidationError(
      'Filter leaf node must specify a "field" (INV-504)',
    );
  }

  if (!allowedFields.includes(node.field)) {
    throw new AstValidationError(
      `Filter field "${node.field}" is not in the allowed filter catalog for this dataset (INV-502, INV-504)`,
    );
  }

  const validOperators: FilterOperator[] = [
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'contains',
    'between',
    'isNull',
    'isNotNull',
  ];

  if (!node.operator || !validOperators.includes(node.operator)) {
    throw new AstValidationError(
      `Filter operator "${node.operator}" is unsupported or invalid (INV-504)`,
    );
  }

  // Bounds on value
  if (
    typeof node.value === 'string' &&
    node.value.length > AST_BOUNDS.MAX_STRING_LENGTH
  ) {
    throw new AstValidationError(
      `Filter string value exceeds maximum length of ${AST_BOUNDS.MAX_STRING_LENGTH} (INV-504)`,
    );
  }

  if (
    Array.isArray(node.value) &&
    node.value.length > AST_BOUNDS.MAX_COLLECTION_VALUES
  ) {
    throw new AstValidationError(
      `Filter collection value exceeds maximum of ${AST_BOUNDS.MAX_COLLECTION_VALUES} items (INV-504)`,
    );
  }
}
