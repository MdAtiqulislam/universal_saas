import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CreateSupplierInvoiceLineDto } from './create-supplier-invoice.dto';

export class UpdateSupplierInvoiceDto {
  @IsDateString()
  @IsOptional()
  invoiceDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @IsUUID()
  @IsOptional()
  goodsReceiptId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  sourceReference?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateSupplierInvoiceLineDto)
  lines?: CreateSupplierInvoiceLineDto[];
}
