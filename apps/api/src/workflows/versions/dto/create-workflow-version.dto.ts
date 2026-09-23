import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowNodeType } from '@prisma/client';

export class NodeInputDto {
  @IsNotEmpty()
  @IsString()
  nodeKey!: string;

  @IsNotEmpty()
  @IsEnum(WorkflowNodeType)
  nodeType!: WorkflowNodeType;

  @IsNotEmpty()
  @IsString()
  label!: string;

  @IsOptional()
  config?: Record<string, unknown>;
}

export class EdgeInputDto {
  @IsNotEmpty()
  @IsString()
  sourceNodeKey!: string;

  @IsNotEmpty()
  @IsString()
  targetNodeKey!: string;

  @IsOptional()
  @IsString()
  conditionRuleId?: string;

  @IsOptional()
  conditionExpression?: Record<string, unknown>;

  @IsOptional()
  priority?: number;
}

export class CreateWorkflowVersionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeInputDto)
  nodes!: NodeInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeInputDto)
  edges!: EdgeInputDto[];
}
