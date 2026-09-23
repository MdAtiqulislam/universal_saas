import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGoodsReceiptLineDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderLineId!: string;

  @IsNotEmpty()
  quantity!: string | number;

  @IsOptional()
  unitCost?: string | number;

  @IsUUID()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsDateString()
  @IsOptional()
  manufacturedAt?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsUUID()
  @IsOptional()
  serialId?: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateGoodsReceiptDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsDateString()
  @IsOptional()
  receivedAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptLineDto)
  lines!: CreateGoodsReceiptLineDto[];
}
