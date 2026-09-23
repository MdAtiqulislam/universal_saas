import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerPriceDto {
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  customerGroupId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  currencyId!: string;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  @Type(() => Number)
  minQuantity?: number = 1;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
