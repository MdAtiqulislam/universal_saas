import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseRequisitionLineDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedUnitPrice?: number;

  @IsDateString()
  @IsNotEmpty()
  requiredDate!: string;

  @IsUUID()
  @IsOptional()
  sourcePlanningResultId?: string;
}

export class CreatePurchaseRequisitionDto {
  @IsDateString()
  @IsNotEmpty()
  requiredDate!: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  sourcePlannedOrderId?: string;

  @IsUUID()
  @IsOptional()
  sourcePlanningRunId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseRequisitionLineDto)
  lines!: CreatePurchaseRequisitionLineDto[];
}

export class UpdatePurchaseRequisitionDto {
  @IsDateString()
  @IsOptional()
  requiredDate?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseRequisitionLineDto)
  @IsOptional()
  lines?: CreatePurchaseRequisitionLineDto[];
}
