import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QualityHoldStatus } from '@prisma/client';

export class CreateQualityHoldDto {
  @IsOptional()
  @IsUUID()
  inspectionLotId?: string;

  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsUUID()
  serialId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  holdQuantity!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReleaseQualityHoldDto {
  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @IsOptional()
  @IsEnum(QualityHoldStatus)
  dispositionStatus?: QualityHoldStatus;
}

export class QueryQualityHoldsDto {
  @IsOptional()
  @IsEnum(QualityHoldStatus)
  status?: QualityHoldStatus;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
