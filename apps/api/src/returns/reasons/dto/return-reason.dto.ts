import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ReturnDispositionType } from '@prisma/client';

export class CreateReturnReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  requiresInspection?: boolean;

  @IsEnum(ReturnDispositionType)
  @IsOptional()
  defaultDisposition?: ReturnDispositionType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateReturnReasonDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  requiresInspection?: boolean;

  @IsEnum(ReturnDispositionType)
  @IsOptional()
  defaultDisposition?: ReturnDispositionType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class QueryReturnReasonDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  search?: string;
}
