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

export class CreateCustomerCreditNoteLineDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  @IsOptional()
  customerInvoiceLineId?: string;

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

export class CreateCustomerCreditNoteDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  @IsOptional()
  customerInvoiceId?: string;

  @IsUUID()
  @IsOptional()
  salesOrderId?: string;

  @IsUUID()
  @IsOptional()
  deliveryOrderId?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsDateString()
  creditDate!: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateCustomerCreditNoteLineDto)
  lines!: CreateCustomerCreditNoteLineDto[];
}
