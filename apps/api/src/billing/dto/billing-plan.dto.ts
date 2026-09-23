import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BillingPlanStatus,
  BillingInterval,
  BillingPricingModel,
} from '@prisma/client';

export class CreateBillingPriceDto {
  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsEnum(BillingInterval)
  interval: BillingInterval = BillingInterval.MONTHLY;

  @IsEnum(BillingPricingModel)
  pricingModel: BillingPricingModel = BillingPricingModel.FLAT;

  @IsInt()
  @Min(0)
  unitAmount: number = 0; // Lossless integer minor units (e.g. cents)
}

export class CreatePlanFeatureDto {
  @IsString()
  featureKey!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @IsOptional()
  @IsInt()
  @Min(0)
  numericLimit?: number;

  @IsOptional()
  @IsBoolean()
  isUnlimited?: boolean = false;
}

export class CreateBillingPlanDto {
  @IsString()
  key!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = true;

  @IsOptional()
  @IsInt()
  sortOrder?: number = 0;
}

export class UpdateBillingPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(BillingPlanStatus)
  status?: BillingPlanStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateBillingPlanVersionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBillingPriceDto)
  prices?: CreateBillingPriceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePlanFeatureDto)
  features?: CreatePlanFeatureDto[];
}

export class PublishPlanVersionDto {
  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export { CreateBillingPlanVersionDto as CreatePlanVersionDto };
