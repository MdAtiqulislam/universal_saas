import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateSequenceDto {
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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
