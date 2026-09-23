import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { NonConformanceSeverity, QualityIssueStatus } from '@prisma/client';

export class CreateCustomerQualityIssueDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

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

  @IsString()
  @IsNotEmpty()
  issueDescription!: string;

  @IsOptional()
  @IsEnum(NonConformanceSeverity)
  severity?: NonConformanceSeverity;

  @IsOptional()
  @IsUUID()
  nonConformanceId?: string;
}

export class ResolveCustomerQualityIssueDto {
  @IsString()
  @IsNotEmpty()
  resolutionNotes!: string;
}

export class QueryCustomerQualityIssuesDto {
  @IsOptional()
  @IsEnum(QualityIssueStatus)
  status?: QualityIssueStatus;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class QuerySupplierQualityDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;
}
