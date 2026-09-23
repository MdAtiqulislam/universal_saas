import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWarehouseTransferLineDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsNotEmpty()
  sourceLocationId!: string;

  @IsString()
  @IsNotEmpty()
  destinationLocationId!: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  serialId?: string;
}

export class CreateWarehouseTransferDto {
  @IsString()
  @IsNotEmpty()
  sourceWarehouseId!: string;

  @IsString()
  @IsNotEmpty()
  destinationWarehouseId!: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWarehouseTransferLineDto)
  lines!: CreateWarehouseTransferLineDto[];
}

export class RejectWarehouseTransferDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}

export class WarehouseTransferQueryDto {
  @IsString()
  @IsOptional()
  sourceWarehouseId?: string;

  @IsString()
  @IsOptional()
  destinationWarehouseId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
