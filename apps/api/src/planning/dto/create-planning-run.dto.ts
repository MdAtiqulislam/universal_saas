import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class CreatePlanningRunDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsBoolean()
  @IsOptional()
  includeSalesOrders?: boolean;

  @IsBoolean()
  @IsOptional()
  includeProductionOrders?: boolean;

  @IsBoolean()
  @IsOptional()
  includeSafetyStock?: boolean;
}
