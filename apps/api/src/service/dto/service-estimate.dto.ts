import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceLineType } from '@prisma/client';

export class ServiceEstimateLineInputDto {
  @IsOptional()
  @IsEnum(ServiceLineType)
  lineType?: ServiceLineType;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitRate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  warrantyCovered?: boolean;
}

export class CreateServiceEstimateDto {
  @IsNotEmpty()
  @IsUUID()
  serviceTicketId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceEstimateLineInputDto)
  lines!: ServiceEstimateLineInputDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveEstimateDto {
  @IsNotEmpty()
  @IsString()
  approvedBy!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectEstimateDto {
  @IsNotEmpty()
  @IsString()
  rejectionReason!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
