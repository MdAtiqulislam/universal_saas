import {
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';

export class UpdateShipmentDto {
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
  shippingCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  insuranceCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  otherCost?: number;

  @IsString()
  @IsOptional()
  specialInstructions?: string;
}
