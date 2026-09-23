import {
  IsString,
  MaxLength,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { JurisdictionType } from '@prisma/client';

export class UpdateTaxJurisdictionDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  countryCode?: string;

  @IsEnum(JurisdictionType)
  @IsOptional()
  type?: JurisdictionType;

  @IsUUID()
  @IsOptional()
  parentJurisdictionId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
