import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { StockMovementType } from '@prisma/client';

export class CreateAdjustmentDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @IsEnum(StockMovementType)
  @IsNotEmpty()
  movementType!: StockMovementType;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Type(() => Number)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason!: string;

  @IsUUID()
  @IsOptional()
  batchId?: string;

  @IsUUID()
  @IsOptional()
  serialId?: string;
}
