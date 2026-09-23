import {
  IsInt,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdatePlanningConfigDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  defaultPlanningHorizonDays?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  defaultLeadTimeDays?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  defaultSafetyStock?: number;

  @IsBoolean()
  @IsOptional()
  includeSalesOrders?: boolean;

  @IsBoolean()
  @IsOptional()
  includeProductionOrders?: boolean;

  @IsBoolean()
  @IsOptional()
  includeSafetyStock?: boolean;

  @IsUUID()
  @IsOptional()
  defaultLocationId?: string;
}
