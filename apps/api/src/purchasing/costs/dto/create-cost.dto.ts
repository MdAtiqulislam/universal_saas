import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
} from 'class-validator';
import { PurchaseCostType, CostAllocationMethod } from '@prisma/client';

export class CreatePurchaseCostDto {
  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @IsUUID()
  @IsOptional()
  goodsReceiptId?: string;

  @IsEnum(PurchaseCostType)
  @IsNotEmpty()
  costType!: PurchaseCostType;

  @IsNotEmpty()
  amount!: string | number;

  @IsUUID()
  @IsNotEmpty()
  currencyId!: string;

  @IsEnum(CostAllocationMethod)
  @IsOptional()
  allocationMethod?: CostAllocationMethod = CostAllocationMethod.BY_VALUE;

  @IsString()
  @IsOptional()
  notes?: string;
}
