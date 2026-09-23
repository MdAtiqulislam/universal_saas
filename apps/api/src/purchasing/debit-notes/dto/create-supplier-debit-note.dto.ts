import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnDisposition } from '@prisma/client';

export class CreateSupplierDebitNoteLineDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  @IsOptional()
  supplierInvoiceLineId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  discountAmount?: number = 0;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  taxRate?: number = 0;

  @IsBoolean()
  @IsOptional()
  returnToInventory?: boolean = false;

  @IsEnum(ReturnDisposition)
  @IsOptional()
  disposition?: ReturnDisposition;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serialNumbers?: string[];
}

export class CreateSupplierDebitNoteDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  @IsOptional()
  supplierInvoiceId?: string;

  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsDateString()
  debitDate!: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateSupplierDebitNoteLineDto)
  lines!: CreateSupplierDebitNoteLineDto[];
}
