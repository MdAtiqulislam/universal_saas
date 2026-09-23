import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateShipmentLineDto {
  @IsUUID()
  @IsNotEmpty()
  deliveryOrderLineId!: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsString()
  @IsOptional()
  packageReference?: string;

  @IsString()
  @IsOptional()
  batchReference?: string;

  @IsString()
  @IsOptional()
  serialReference?: string;
}

export class CreateShipmentDto {
  @IsUUID()
  @IsNotEmpty()
  deliveryOrderId!: string;

  @IsUUID()
  @IsOptional()
  carrierId?: string;

  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  serviceType?: string;

  @IsString()
  @IsOptional()
  shipFromAddress?: string;

  @IsString()
  @IsOptional()
  shipToAddress?: string;

  @IsDateString()
  @IsOptional()
  plannedShipDate?: string;

  @IsDateString()
  @IsOptional()
  estimatedDeliveryDate?: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  externalReference?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  shippingCost?: number = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  insuranceCost?: number = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  otherCost?: number = 0;

  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShipmentLineDto)
  @IsOptional()
  lines?: CreateShipmentLineDto[];
}
