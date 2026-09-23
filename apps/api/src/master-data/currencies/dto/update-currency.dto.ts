import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCurrencyDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString()
  @IsOptional()
  @Length(1, 10)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  symbol?: string;

  @IsInt()
  @Min(0)
  @Max(8)
  @IsOptional()
  decimalPlaces?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
