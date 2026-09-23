import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignCarrierDto {
  @IsUUID()
  @IsNotEmpty()
  carrierId!: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  serviceType?: string;
}
