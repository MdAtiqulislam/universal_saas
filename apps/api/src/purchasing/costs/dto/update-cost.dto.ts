import { IsUUID, IsOptional, IsEnum, IsString } from 'class-validator';
import { PurchaseCostType, CostAllocationMethod } from '@prisma/client';

export class UpdatePurchaseCostDto {
  @IsEnum(PurchaseCostType)
  @IsOptional()
  costType?: PurchaseCostType;

  @IsOptional()
  amount?: string | number;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsEnum(CostAllocationMethod)
  @IsOptional()
  allocationMethod?: CostAllocationMethod;

  @IsString()
  @IsOptional()
  notes?: string;
}
