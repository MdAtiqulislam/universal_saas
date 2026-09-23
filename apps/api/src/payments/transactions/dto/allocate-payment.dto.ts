import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentAllocationItemDto {
  @IsUUID()
  @IsOptional()
  customerInvoiceId?: string;

  @IsUUID()
  @IsOptional()
  supplierInvoiceId?: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  amount!: number;
}

export class AllocatePaymentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationItemDto)
  allocations!: PaymentAllocationItemDto[];
}
