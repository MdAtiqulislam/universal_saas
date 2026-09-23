import {
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePurchaseOrderLineDto } from './create-order.dto';

export class UpdatePurchaseOrderDto {
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  paymentTermsDays?: number;

  @IsOptional()
  shippingTotal?: string | number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  @IsOptional()
  lines?: CreatePurchaseOrderLineDto[];
}
