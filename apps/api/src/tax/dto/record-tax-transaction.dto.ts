import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaxScope } from '@prisma/client';

export class RecordTaxTransactionDto {
  @IsUUID()
  taxCodeId!: string;

  @IsUUID()
  @IsOptional()
  jurisdictionId?: string;

  @IsDateString()
  transactionDate!: string;

  @IsEnum(TaxScope)
  taxScope!: TaxScope; // INPUT or OUTPUT

  @IsString()
  sourceType!: string; // CUSTOMER_INVOICE, SUPPLIER_INVOICE, CUSTOMER_CREDIT_NOTE, SUPPLIER_DEBIT_NOTE, MANUAL_ADJUSTMENT

  @IsString()
  sourceId!: string;

  @IsString()
  @IsOptional()
  sourceNumber?: string;

  @IsString()
  @IsOptional()
  currencyCode?: string = 'USD';

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  taxableAmount!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  taxRate!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  taxAmount!: number;

  @IsBoolean()
  @IsOptional()
  isReversal?: boolean = false;

  @IsUUID()
  @IsOptional()
  reversalOfTaxTransactionId?: string;

  @IsUUID()
  @IsOptional()
  journalEntryId?: string;

  @IsOptional()
  postToGl?: boolean = false;
}
