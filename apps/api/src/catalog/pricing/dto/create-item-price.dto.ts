import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemPriceDto {
  @IsUUID()
  @IsNotEmpty()
  pricingTierId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @IsOptional()
  @Type(() => Number)
  minQuantity?: number = 1;
}
