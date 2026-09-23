import {
  IsNumber,
  Min,
  IsBoolean,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCustomerPriceDto {
  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  @Type(() => Number)
  minQuantity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;

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
