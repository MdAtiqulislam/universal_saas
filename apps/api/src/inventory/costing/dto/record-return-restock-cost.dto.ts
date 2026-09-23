import { IsUUID, IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordReturnRestockCostDto {
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

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  unitCost?: number; // Defaults to current average cost if omitted

  @IsUUID()
  @IsOptional()
  creditNoteId?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsOptional()
  postToGl?: boolean = true;
}
