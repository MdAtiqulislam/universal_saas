import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsEnum,
  IsString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaxRuleTransactionType } from '@prisma/client';

export class CalculateTaxLineItemDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

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
  discount?: number = 0;

  @IsString()
  @IsOptional()
  taxCodeOverride?: string; // Code string e.g. "ZERO_RATED" or TaxCode UUID
}

export class CalculateTaxDto {
  @IsDateString()
  transactionDate!: string;

  @IsEnum(TaxRuleTransactionType)
  transactionType!: TaxRuleTransactionType; // SALES or PURCHASING

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  customerGroupId?: string;

  @IsUUID()
  @IsOptional()
  jurisdictionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalculateTaxLineItemDto)
  lines!: CalculateTaxLineItemDto[];
}
