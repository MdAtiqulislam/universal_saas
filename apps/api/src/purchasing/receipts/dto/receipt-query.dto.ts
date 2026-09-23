import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GoodsReceiptStatus } from '@prisma/client';

export class GoodsReceiptQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;

  @IsEnum(GoodsReceiptStatus)
  @IsOptional()
  status?: GoodsReceiptStatus;

  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
