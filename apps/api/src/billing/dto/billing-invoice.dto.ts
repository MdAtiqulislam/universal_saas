import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillingInvoiceStatus } from '@prisma/client';

export class InvoiceLineItemDto {
  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  itemType?: string = 'SUBSCRIPTION';

  @IsInt()
  @Min(1)
  quantity: number = 1;

  @IsInt()
  @Min(0)
  unitAmount!: number;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems!: InvoiceLineItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  taxAmount?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number = 0;
}

export class InvoiceQueryDto {
  @IsOptional()
  @IsEnum(BillingInvoiceStatus)
  status?: BillingInvoiceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ApplyPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number; // in minor units

  @IsOptional()
  @IsString()
  providerKey?: string = 'sandbox';

  @IsOptional()
  @IsString()
  providerTransactionId?: string;
}
