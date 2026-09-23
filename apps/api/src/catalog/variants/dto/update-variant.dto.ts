import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateVariantDto {
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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
