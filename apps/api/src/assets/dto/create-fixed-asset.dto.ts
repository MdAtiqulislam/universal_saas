import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  IsNumber,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { AssetDepreciationMethod } from '@prisma/client';

export class CreateFixedAssetDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  assetNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  serialNumber?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @IsUUID()
  @IsOptional()
  goodsReceiptId?: string;

  @IsUUID()
  @IsOptional()
  supplierInvoiceId?: string;

  @IsUUID()
  @IsNotEmpty()
  currencyId!: string;

  @IsDateString()
  @IsNotEmpty()
  acquisitionDate!: string;

  @IsDateString()
  @IsOptional()
  placedInServiceDate?: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  acquisitionCost!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  residualValue?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  usefulLifeMonths?: number;

  @IsEnum(AssetDepreciationMethod)
  @IsOptional()
  depreciationMethod?: AssetDepreciationMethod;

  @IsUUID()
  @IsOptional()
  assetAccountId?: string;

  @IsUUID()
  @IsOptional()
  accumulatedDepreciationAccountId?: string;

  @IsUUID()
  @IsOptional()
  depreciationExpenseAccountId?: string;
}
