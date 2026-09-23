import {
  IsNumber,
  IsPositive,
  IsOptional,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateItemPriceDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @IsOptional()
  @Type(() => Number)
  minQuantity?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
