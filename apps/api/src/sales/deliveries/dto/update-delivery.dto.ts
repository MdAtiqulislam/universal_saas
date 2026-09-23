import { IsUUID, IsOptional, IsDateString, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateDeliveryOrderDto {
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
}
