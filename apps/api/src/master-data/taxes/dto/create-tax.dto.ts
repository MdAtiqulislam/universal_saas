import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateTaxDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'Rate must be a valid number with at most 4 decimal places' },
  )
  @Min(0, { message: 'Tax rate cannot be negative' })
  @Max(100, { message: 'Tax rate cannot exceed 100%' })
  rate!: number;

  @IsBoolean()
  @IsOptional()
  isInclusive?: boolean;
}
