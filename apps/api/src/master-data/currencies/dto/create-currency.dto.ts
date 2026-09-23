import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCurrencyDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 10)
  @Matches(/^[A-Za-z]+$/, {
    message: 'Currency code must contain only alphabetic characters',
  })
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
}
