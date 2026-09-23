import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  sku!: string;

  @IsString()
  @IsOptional()
  @Length(2, 200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;
}
