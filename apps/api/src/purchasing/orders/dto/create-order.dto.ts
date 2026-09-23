import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderLineDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNotEmpty()
  quantity!: string | number;

  @IsNotEmpty()
  unitPrice!: string | number;

  @IsOptional()
  discountAmount?: string | number = 0;

  @IsOptional()
  taxRate?: string | number = 0;
}

export class CreatePurchaseOrderDto {
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
  @Type(() => Number)
  paymentTermsDays?: number = 0;

  @IsOptional()
  shippingTotal?: string | number = 0;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines!: CreatePurchaseOrderLineDto[];
}
