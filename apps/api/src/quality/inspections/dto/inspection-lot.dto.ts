import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InspectionType,
  InspectionDecision,
  InspectionLotStatus,
} from '@prisma/client';

export class CreateInspectionLotDto {
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsUUID()
  inspectionPlanId?: string;

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

  @IsEnum(InspectionType)
  inspectionType!: InspectionType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  totalQuantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  sampleQuantity?: number;

  @IsOptional()
  @IsUUID()
  goodsReceiptId?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  deliveryOrderId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordInspectionResultItemDto {
  @IsUUID()
  characteristicId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  sampleNumber!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  observedNumericValue?: number;

  @IsOptional()
  @IsString()
  observedTextValue?: string;

  @IsBoolean()
  isPass!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordInspectionResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordInspectionResultItemDto)
  results!: RecordInspectionResultItemDto[];
}

export class MakeInspectionDecisionDto {
  @IsEnum(InspectionDecision)
  decision!: InspectionDecision;

  @IsOptional()
  @IsString()
  decisionNotes?: string;

  @IsOptional()
  @IsBoolean()
  createNcrOnFailure?: boolean;

  @IsOptional()
  @IsString()
  ncrTitle?: string;

  @IsOptional()
  @IsString()
  ncrDescription?: string;
}

export class QueryInspectionLotsDto {
  @IsOptional()
  @IsEnum(InspectionLotStatus)
  status?: InspectionLotStatus;

  @IsOptional()
  @IsEnum(InspectionType)
  inspectionType?: InspectionType;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  goodsReceiptId?: string;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
