import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsString,
  IsDateString,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CreateSalesOrderLineDto } from './create-order.dto';

export class UpdateSalesOrderDto {
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  paymentTermsDays?: number;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  shippingTotal?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateSalesOrderLineDto)
  lines?: CreateSalesOrderLineDto[];
}
