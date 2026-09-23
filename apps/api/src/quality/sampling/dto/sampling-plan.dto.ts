import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SamplingType } from '@prisma/client';

export class CreateSamplingPlanDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(SamplingType)
  samplingType!: SamplingType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  fixedSampleQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(100)
  percentageRate?: number;

  @IsOptional()
  lotRangesJson?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSamplingPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SamplingType)
  samplingType?: SamplingType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  fixedSampleQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(100)
  percentageRate?: number;

  @IsOptional()
  lotRangesJson?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QuerySamplingPlansDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}
