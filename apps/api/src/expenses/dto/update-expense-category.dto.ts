import {
  IsString,
  MaxLength,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateExpenseCategoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  glAccountId?: string;

  @IsUUID()
  @IsOptional()
  taxCodeId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
