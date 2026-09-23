import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WarrantyStatus, ServiceOrderStatus } from '@prisma/client';

export class CreateServiceOrderDto {
  @IsOptional()
  @IsUUID()
  serviceTicketId?: string;

  @IsNotEmpty()
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  customerAssetId?: string;

  @IsOptional()
  @IsUUID()
  serviceLocationId?: string;

  @IsOptional()
  @IsUUID()
  assignedTechnicianId?: string;

  @IsOptional()
  @IsEnum(WarrantyStatus)
  warrantyStatus?: WarrantyStatus;

  @IsOptional()
  @IsUUID()
  estimateId?: string;

  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @IsOptional()
  @IsDateString()
  scheduledEndAt?: string;

  @IsOptional()
  @IsUUID()
  sourceRmaId?: string;
}

export class UpdateServiceOrderDto {
  @IsOptional()
  @IsUUID()
  serviceLocationId?: string;

  @IsOptional()
  @IsUUID()
  assignedTechnicianId?: string;

  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @IsOptional()
  @IsDateString()
  scheduledEndAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  otherCost?: number;
}

export class QueryServiceOrderDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  customerAssetId?: string;

  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @IsOptional()
  @IsUUID()
  assignedTechnicianId?: string;

  @IsOptional()
  @IsUUID()
  sourceRmaId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
