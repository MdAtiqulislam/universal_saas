import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { WarrantyStatus, CustomerAssetServiceStatus } from '@prisma/client';

export class CreateCustomerAssetDto {
  @IsNotEmpty()
  @IsUUID()
  customerId!: string;

  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsUUID()
  serialId?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsUUID()
  originalSalesOrderId?: string;

  @IsOptional()
  @IsUUID()
  deliveryOrderId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @IsOptional()
  @IsUUID()
  customerInvoiceId?: string;

  @IsOptional()
  @IsDateString()
  installationDate?: string;

  @IsNotEmpty()
  @IsDateString()
  purchaseDate!: string;

  @IsNotEmpty()
  @IsDateString()
  warrantyStartDate!: string;

  @IsNotEmpty()
  @IsDateString()
  warrantyEndDate!: string;

  @IsOptional()
  @IsEnum(WarrantyStatus)
  warrantyStatus?: WarrantyStatus;

  @IsOptional()
  @IsEnum(CustomerAssetServiceStatus)
  serviceStatus?: CustomerAssetServiceStatus;

  @IsOptional()
  @IsString()
  locationAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  warrantyPolicyId?: string;
}

export class UpdateCustomerAssetDto {
  @IsOptional()
  @IsEnum(WarrantyStatus)
  warrantyStatus?: WarrantyStatus;

  @IsOptional()
  @IsEnum(CustomerAssetServiceStatus)
  serviceStatus?: CustomerAssetServiceStatus;

  @IsOptional()
  @IsDateString()
  installationDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyEndDate?: string;

  @IsOptional()
  @IsString()
  locationAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryCustomerAssetDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsEnum(WarrantyStatus)
  warrantyStatus?: WarrantyStatus;

  @IsOptional()
  @IsEnum(CustomerAssetServiceStatus)
  serviceStatus?: CustomerAssetServiceStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
