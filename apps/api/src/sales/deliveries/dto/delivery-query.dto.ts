import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { DeliveryOrderStatus } from '@prisma/client';

export class DeliveryOrderQueryDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  @IsUUID()
  @IsOptional()
  salesOrderId?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsEnum(DeliveryOrderStatus)
  @IsOptional()
  status?: DeliveryOrderStatus;
}
