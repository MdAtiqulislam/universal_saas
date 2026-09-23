import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePricingTierDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
