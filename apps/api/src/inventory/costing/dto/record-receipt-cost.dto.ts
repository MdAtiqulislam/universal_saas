import { IsUUID, IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordReceiptCostDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  locationId!: string;

  @IsUUID()
  @IsOptional()
  batchId?: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  unitCost!: number;

  @IsString()
  sourceDocument!: string; // 'GOODS_RECEIPT', 'OPENING_BALANCE', etc.

  @IsString()
  @IsOptional()
  sourceDocumentId?: string;

  @IsOptional()
  postToGl?: boolean = true;
}
