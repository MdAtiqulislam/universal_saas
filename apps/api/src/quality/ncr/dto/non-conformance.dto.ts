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
import { NonConformanceSeverity, NonConformanceStatus } from '@prisma/client';

export class CreateNonConformanceDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsUUID()
  sourceInspectionLotId?: string;

  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsUUID()
  serialId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantityAffected!: number;

  @IsOptional()
  @IsEnum(NonConformanceSeverity)
  severity?: NonConformanceSeverity;

  @IsOptional()
  @IsString()
  containmentAction?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  disposition?: string;

  @IsOptional()
  @IsString()
  dispositionNotes?: string;

  @IsOptional()
  targetDate?: string;
}

export class ContainNonConformanceDto {
  @IsString()
  @IsNotEmpty()
  containmentAction!: string;
}

export class InvestigateNonConformanceDto {
  @IsString()
  @IsNotEmpty()
  rootCause!: string;
}

export class DispositionNonConformanceDto {
  @IsString()
  @IsNotEmpty()
  disposition!: string;

  @IsOptional()
  @IsString()
  dispositionNotes?: string;

  @IsOptional()
  isCapaRequired?: boolean;
}

export class CloseNonConformanceDto {
  @IsOptional()
  @IsString()
  closingNotes?: string;
}

export class QueryNonConformanceDto {
  @IsOptional()
  @IsEnum(NonConformanceStatus)
  status?: NonConformanceStatus;

  @IsOptional()
  @IsEnum(NonConformanceSeverity)
  severity?: NonConformanceSeverity;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
