import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import {
  ServiceRequestType,
  ServicePriority,
  ServiceRequestStatus,
} from '@prisma/client';

export class CreateServiceRequestDto {
  @IsNotEmpty()
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  customerAssetId?: string;

  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsEnum(ServiceRequestType)
  requestType?: ServiceRequestType;

  @IsOptional()
  @IsEnum(ServicePriority)
  priority?: ServicePriority;

  @IsNotEmpty()
  @IsString()
  issueCategory!: string;

  @IsNotEmpty()
  @IsString()
  subject!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsUUID()
  sourceRmaId?: string;

  @IsOptional()
  @IsDateString()
  preferredServiceDate?: string;
}

export class UpdateServiceRequestDto {
  @IsOptional()
  @IsEnum(ServicePriority)
  priority?: ServicePriority;

  @IsOptional()
  @IsString()
  issueCategory?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  preferredServiceDate?: string;
}

export class TriageServiceRequestDto {
  @IsNotEmpty()
  @IsString()
  triageNotes!: string;

  @IsOptional()
  @IsEnum(ServicePriority)
  priority?: ServicePriority;

  @IsOptional()
  @IsUUID()
  assignedTechnicianId?: string;
}

export class QueryServiceRequestDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  customerAssetId?: string;

  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @IsOptional()
  @IsEnum(ServicePriority)
  priority?: ServicePriority;

  @IsOptional()
  @IsEnum(ServiceRequestType)
  requestType?: ServiceRequestType;

  @IsOptional()
  @IsString()
  search?: string;
}
