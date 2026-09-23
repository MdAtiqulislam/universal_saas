import {
  IsString,
  MaxLength,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaxType, TaxScope } from '@prisma/client';

export class UpdateTaxCodeDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaxType)
  @IsOptional()
  taxType?: TaxType;

  @IsEnum(TaxScope)
  @IsOptional()
  taxScope?: TaxScope;

  @IsUUID()
  @IsOptional()
  jurisdictionId?: string;

  @IsBoolean()
  @IsOptional()
  isExempt?: boolean;

  @IsBoolean()
  @IsOptional()
  isZeroRated?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
