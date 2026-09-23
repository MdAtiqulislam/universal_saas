import { IsUUID, IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordIssueCogsDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  locationId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsUUID()
  @IsOptional()
  stockMovementId?: string;

  @IsUUID()
  @IsOptional()
  deliveryOrderId?: string;

  @IsString()
  sourceDocument!: string; // 'DELIVERY_ORDER', 'STOCK_ISSUE', etc.

  @IsString()
  @IsOptional()
  sourceDocumentId?: string;

  @IsOptional()
  postToGl?: boolean = true;
}
