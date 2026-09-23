import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsInt,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaxRuleTransactionType } from '@prisma/client';

export class CreateTaxRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  priority?: number = 100;

  @IsEnum(TaxRuleTransactionType)
  @IsOptional()
  transactionType?: TaxRuleTransactionType = TaxRuleTransactionType.BOTH;

  @IsUUID()
  taxCodeId!: string;

  @IsUUID()
  @IsOptional()
  jurisdictionId?: string;

  @IsUUID()
  @IsOptional()
  customerGroupId?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  itemCategoryId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
