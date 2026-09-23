import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsDateString,
  IsString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateDeliveryOrderLineDto {
  @IsUUID()
  salesOrderLineId!: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsUUID()
  @IsOptional()
  batchId?: string;

  @IsUUID()
  @IsOptional()
  serialId?: string;
}

export class CreateDeliveryOrderDto {
  @IsUUID()
  salesOrderId!: string;

  @IsUUID()
  @IsOptional()
  shippingAddressId?: string;

  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryOrderLineDto)
  lines!: CreateDeliveryOrderLineDto[];
}
