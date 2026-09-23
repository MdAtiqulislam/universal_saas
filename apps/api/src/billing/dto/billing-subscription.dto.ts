import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { BillingSubscriptionStatus } from '@prisma/client';

export class CreateSubscriptionDto {
  @IsString()
  planVersionId!: string;

  @IsOptional()
  @IsString()
  priceId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number = 14;

  @IsOptional()
  @IsString()
  scope?: string = 'PLATFORM';
}

export class UpgradeSubscriptionDto {
  @IsString()
  newPlanVersionId!: string;

  @IsOptional()
  @IsString()
  newPriceId?: string;

  @IsOptional()
  @IsBoolean()
  immediate?: boolean = true; // If true, proration is calculated immediately
}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  immediately?: boolean = false; // Default: cancel at period end

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SubscriptionQueryDto {
  @IsOptional()
  @IsEnum(BillingSubscriptionStatus)
  status?: BillingSubscriptionStatus;

  @IsOptional()
  @IsString()
  scope?: string;
}
