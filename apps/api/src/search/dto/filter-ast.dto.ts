import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'notEquals',
  CONTAINS = 'contains',
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
  GREATER_THAN = 'greaterThan',
  GREATER_THAN_OR_EQUAL = 'greaterThanOrEqual',
  LESS_THAN = 'lessThan',
  LESS_THAN_OR_EQUAL = 'lessThanOrEqual',
  BETWEEN = 'between',
  IN = 'in',
  NOT_IN = 'notIn',
  IS_NULL = 'isNull',
  IS_NOT_NULL = 'isNotNull',
}

export enum LogicalOperator {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
}

export class FieldConditionDto {
  @IsString()
  @MaxLength(100)
  field!: string;

  @IsEnum(FilterOperator)
  operator!: FilterOperator;

  @IsOptional()
  value?: unknown;

  @IsOptional()
  secondaryValue?: unknown;
}

export class LogicalGroupDto {
  @IsEnum(LogicalOperator)
  logicalOperator!: LogicalOperator;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => Object)
  conditions!: (FieldConditionDto | LogicalGroupDto)[];
}

export type FilterNode = FieldConditionDto | LogicalGroupDto;
