import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaxType, TaxScope } from '@prisma/client';

export class CreateTaxCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaxType)
  @IsOptional()
  taxType?: TaxType = TaxType.VAT;

  @IsEnum(TaxScope)
  @IsOptional()
  taxScope?: TaxScope = TaxScope.BOTH;

  @IsUUID()
  @IsOptional()
  jurisdictionId?: string;

  @IsBoolean()
  @IsOptional()
  isExempt?: boolean = false;

  @IsBoolean()
  @IsOptional()
  isZeroRated?: boolean = false;

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean = false;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
