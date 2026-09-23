import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { WorkflowScheduleType, WorkflowScheduleStatus } from '@prisma/client';

export class CreateScheduleDto {
  @IsNotEmpty()
  @IsEnum(WorkflowScheduleType)
  scheduleType!: WorkflowScheduleType;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  intervalSeconds?: number;

  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsEnum(WorkflowScheduleType)
  scheduleType?: WorkflowScheduleType;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  intervalSeconds?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(WorkflowScheduleStatus)
  status?: WorkflowScheduleStatus;
}
