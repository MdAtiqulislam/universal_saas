import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateItemPlanningProfileDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  leadTimeDays?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  safetyStock?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reorderPoint?: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  minOrderQuantity?: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  maxOrderQuantity?: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  orderMultiple?: number;

  @IsUUID()
  @IsOptional()
  preferredSupplierId?: string;

  @IsUUID()
  @IsOptional()
  preferredBomId?: string;
}

export class UpdateItemPlanningProfileDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  leadTimeDays?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  safetyStock?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reorderPoint?: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  minOrderQuantity?: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  maxOrderQuantity?: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  orderMultiple?: number;

  @IsUUID()
  @IsOptional()
  preferredSupplierId?: string;

  @IsUUID()
  @IsOptional()
  preferredBomId?: string;
}
