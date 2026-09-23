import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
  IsUUID,
} from 'class-validator';
import { WarrantyCoverageType, WarrantyStatus } from '@prisma/client';

export class CreateWarrantyPolicyDto {
  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  durationMonths!: number;

  @IsOptional()
  @IsEnum(WarrantyCoverageType)
  coverageType?: WarrantyCoverageType;

  @IsOptional()
  @IsBoolean()
  laborCovered?: boolean;

  @IsOptional()
  @IsBoolean()
  partsCovered?: boolean;

  @IsOptional()
  @IsBoolean()
  replacementCovered?: boolean;

  @IsOptional()
  @IsBoolean()
  inspectionRequired?: boolean;

  @IsOptional()
  exclusions?: any;

  @IsNotEmpty()
  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWarrantyPolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number;

  @IsOptional()
  @IsEnum(WarrantyCoverageType)
  coverageType?: WarrantyCoverageType;

  @IsOptional()
  @IsBoolean()
  laborCovered?: boolean;

  @IsOptional()
  @IsBoolean()
  partsCovered?: boolean;

  @IsOptional()
  @IsBoolean()
  replacementCovered?: boolean;

  @IsOptional()
  @IsBoolean()
  inspectionRequired?: boolean;

  @IsOptional()
  exclusions?: any;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CheckWarrantyEligibilityDto {
  @IsNotEmpty()
  @IsUUID()
  customerAssetId!: string;

  @IsOptional()
  @IsDateString()
  serviceDate?: string;

  @IsOptional()
  @IsString()
  issueCategory?: string;
}

export class AssignAssetWarrantyDto {
  @IsNotEmpty()
  @IsUUID()
  warrantyPolicyId!: string;

  @IsNotEmpty()
  @IsDateString()
  startDate!: string;

  @IsNotEmpty()
  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsEnum(WarrantyStatus)
  status?: WarrantyStatus;

  @IsOptional()
  claimLimitAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
