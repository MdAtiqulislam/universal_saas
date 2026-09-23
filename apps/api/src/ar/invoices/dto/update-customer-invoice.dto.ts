import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CreateCustomerInvoiceLineDto } from './create-customer-invoice.dto';

export class UpdateCustomerInvoiceDto {
  @IsDateString()
  @IsOptional()
  invoiceDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  paymentTermsDays?: number;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsUUID()
  @IsOptional()
  salesOrderId?: string;

  @IsUUID()
  @IsOptional()
  deliveryOrderId?: string;

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
  @Type(() => CreateCustomerInvoiceLineDto)
  lines?: CreateCustomerInvoiceLineDto[];
}
