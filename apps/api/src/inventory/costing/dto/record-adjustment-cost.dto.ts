import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StockMovementType } from '@prisma/client';

export class RecordAdjustmentCostDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  locationId!: string;

  @IsEnum(StockMovementType)
  movementType!: StockMovementType; // ADJUSTMENT_IN or ADJUSTMENT_OUT

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  unitCost?: number; // Optional for ADJUSTMENT_IN; for ADJUSTMENT_OUT defaults to current average cost

  @IsUUID()
  @IsOptional()
  stockMovementId?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsOptional()
  postToGl?: boolean = true;
}
