import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUnitDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
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
  @Max(6)
  @IsOptional()
  decimalPlaces?: number;
}
