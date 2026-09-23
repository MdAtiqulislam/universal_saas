import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReplenishmentRuleDto {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsNotEmpty()
  sourceLocationId!: string;

  @IsString()
  @IsNotEmpty()
  destinationLocationId!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minQuantity!: number;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  maxQuantity!: number;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  replenishQuantity!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateReplenishmentRuleDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minQuantity?: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  @Type(() => Number)
  maxQuantity?: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  @Type(() => Number)
  replenishQuantity?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class GenerateReplenishmentDto {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;
}

export class ReplenishmentQueryDto {
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  itemId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
