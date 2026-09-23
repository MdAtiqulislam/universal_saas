import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddServicePartRequirementDto {
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  requiredQuantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice?: number;

  @IsOptional()
  @IsBoolean()
  warrantyCovered?: boolean;
}

export class ReserveServicePartsDto {
  @IsNotEmpty()
  @IsUUID()
  partRequirementId!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;
}

export class IssueServicePartsDto {
  @IsNotEmpty()
  @IsUUID()
  partRequirementId!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost?: number;
}

export class ReturnServicePartsDto {
  @IsNotEmpty()
  @IsUUID()
  partRequirementId!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;
}
