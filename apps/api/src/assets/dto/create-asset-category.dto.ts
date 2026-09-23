import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { AssetDepreciationMethod } from '@prisma/client';

export class CreateAssetCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  assetAccountId?: string;

  @IsUUID()
  @IsOptional()
  accumulatedDepreciationAccountId?: string;

  @IsUUID()
  @IsOptional()
  depreciationExpenseAccountId?: string;

  @IsEnum(AssetDepreciationMethod)
  @IsOptional()
  depreciationMethod?: AssetDepreciationMethod;

  @IsInt()
  @Min(1)
  @IsOptional()
  defaultUsefulLifeMonths?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  defaultResidualValuePercent?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
