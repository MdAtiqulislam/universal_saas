import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePricingTierDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  currencyId!: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
