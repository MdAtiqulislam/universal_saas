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
import { JurisdictionType } from '@prisma/client';

export class CreateTaxJurisdictionDto {
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
  @IsNotEmpty()
  @MaxLength(2)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  countryCode!: string;

  @IsEnum(JurisdictionType)
  @IsOptional()
  type?: JurisdictionType = JurisdictionType.COUNTRY;

  @IsUUID()
  @IsOptional()
  parentJurisdictionId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
