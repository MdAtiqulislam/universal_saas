import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceivePOLineItemDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderLineId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsDateString()
  @IsOptional()
  batchExpiryDate?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serialNumbers?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReceivePurchaseOrderDto {
  @IsDateString()
  @IsOptional()
  receivedAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePOLineItemDto)
  lines!: ReceivePOLineItemDto[];
}
