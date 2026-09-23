import { IsOptional, IsString, IsDateString } from 'class-validator';

export class DispatchShipmentDto {
  @IsDateString()
  @IsOptional()
  actualShipDate?: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
