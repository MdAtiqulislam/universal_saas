import {
  IsOptional,
  IsEnum,
  IsString,
  IsUUID,
  IsDateString,
} from 'class-validator';
import {
  PlanningRunStatus,
  PlannedOrderAction,
  PlannedOrderStatus,
} from '@prisma/client';

export class PlanningRunQueryDto {
  @IsEnum(PlanningRunStatus)
  @IsOptional()
  status?: PlanningRunStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsString()
  @IsOptional()
  search?: string;
}

export class PlannedOrderQueryDto {
  @IsEnum(PlannedOrderAction)
  @IsOptional()
  action?: PlannedOrderAction;

  @IsEnum(PlannedOrderStatus)
  @IsOptional()
  status?: PlannedOrderStatus;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class PlanningReportsQueryDto {
  @IsUUID()
  @IsOptional()
  planningRunId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
