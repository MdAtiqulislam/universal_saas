import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
  Length,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateBatchDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  batchNumber!: string;

  @IsDateString()
  @IsOptional()
  manufacturedAt?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  initialQuantity?: number = 0;
}
