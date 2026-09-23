import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEffectiveTaxRateDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  rate?: number;

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @IsBoolean()
  @IsOptional()
  isInclusive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}
