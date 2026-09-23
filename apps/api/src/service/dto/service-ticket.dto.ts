import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import {
  ServicePriority,
  ServiceTicketStatus,
  ServiceSlaStatus,
} from '@prisma/client';

export class CreateServiceTicketDto {
  @IsOptional()
  @IsUUID()
  serviceRequestId?: string;

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
  @IsEnum(ServicePriority)
  priority?: ServicePriority;

  @IsNotEmpty()
  @IsString()
  subject!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsUUID()
  assignedTechnicianId?: string;
}

export class AssignTechnicianDto {
  @IsNotEmpty()
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryServiceTicketDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  customerAssetId?: string;

  @IsOptional()
  @IsEnum(ServiceTicketStatus)
  status?: ServiceTicketStatus;

  @IsOptional()
  @IsEnum(ServicePriority)
  priority?: ServicePriority;

  @IsOptional()
  @IsEnum(ServiceSlaStatus)
  slaStatus?: ServiceSlaStatus;

  @IsOptional()
  @IsUUID()
  assignedTechnicianId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
