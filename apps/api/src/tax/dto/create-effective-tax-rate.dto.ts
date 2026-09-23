import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEffectiveTaxRateDto {
  @IsUUID()
  taxCodeId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  rate!: number; // e.g. 0.20 for 20%

  @IsDateString()
  effectiveFrom!: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @IsBoolean()
  @IsOptional()
  isInclusive?: boolean = false;

  @IsString()
  @IsOptional()
  description?: string;
}
