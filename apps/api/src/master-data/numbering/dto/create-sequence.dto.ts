import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateSequenceDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  key!: string;

  @IsString()
  @IsOptional()
  @Length(1, 20)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  prefix?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  nextNumber?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  @IsOptional()
  padding?: number;
}
