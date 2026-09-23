import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowExecutionStatus } from '@prisma/client';

export class ExecuteWorkflowDto {
  @IsOptional()
  inputContext?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  clientIdempotencyKey?: string;
}

export class RetryExecutionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class QueryExecutionsDto {
  @IsOptional()
  @IsString()
  workflowDefinitionId?: string;

  @IsOptional()
  @IsEnum(WorkflowExecutionStatus)
  status?: WorkflowExecutionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
