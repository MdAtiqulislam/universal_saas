import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { BillingCreditType, BillingDiscountDuration } from '@prisma/client';

export class GrantCreditDto {
  @IsInt()
  @Min(1)
  amount!: number; // in minor units

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CreateDiscountDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(BillingCreditType)
  discountType: BillingCreditType = BillingCreditType.PERCENTAGE;

  @IsInt()
  @Min(1)
  value!: number; // e.g. 20 for 20% or 500 for $5.00

  @IsEnum(BillingDiscountDuration)
  duration: BillingDiscountDuration = BillingDiscountDuration.ONCE;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;
}
