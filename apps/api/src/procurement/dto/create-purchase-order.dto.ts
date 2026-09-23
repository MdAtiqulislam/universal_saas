import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProcurementPOLineDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRate?: number;

  @IsDateString()
  @IsOptional()
  requiredDate?: string;

  @IsDateString()
  @IsOptional()
  expectedReceiptDate?: string;
}

export class CreateProcurementPurchaseOrderDto {
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @IsUUID()
  @IsNotEmpty()
  currencyId!: string;

  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  paymentTermsDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  supplierReference?: string;

  @IsString()
  @IsOptional()
  shippingTerms?: string;

  @IsUUID()
  @IsOptional()
  requisitionId?: string;

  @IsUUID()
  @IsOptional()
  plannedOrderId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  shippingTotal?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProcurementPOLineDto)
  lines!: CreateProcurementPOLineDto[];
}

export class UpdateProcurementPurchaseOrderDto {
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  paymentTermsDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  supplierReference?: string;

  @IsString()
  @IsOptional()
  shippingTerms?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  shippingTotal?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProcurementPOLineDto)
  @IsOptional()
  lines?: CreateProcurementPOLineDto[];
}

export class AcknowledgePurchaseOrderDto {
  @IsString()
  @IsOptional()
  supplierReference?: string;

  @IsDateString()
  @IsOptional()
  confirmedDeliveryDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  confirmedQuantity?: number;

  @IsString()
  @IsOptional()
  supplierNotes?: string;
}
