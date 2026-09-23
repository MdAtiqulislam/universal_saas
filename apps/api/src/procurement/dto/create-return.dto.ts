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

export class CreatePurchaseReturnLineDto {
  @IsUUID()
  @IsNotEmpty()
  goodsReceiptLineId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

export class CreatePurchaseReturnDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @IsUUID()
  @IsNotEmpty()
  goodsReceiptId!: string;

  @IsDateString()
  @IsOptional()
  returnDate?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnLineDto)
  lines!: CreatePurchaseReturnLineDto[];
}
