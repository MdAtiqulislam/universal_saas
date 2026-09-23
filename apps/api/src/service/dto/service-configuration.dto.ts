import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateServiceConfigurationDto {
  @IsOptional()
  @IsUUID()
  defaultServiceLocationId?: string;

  @IsOptional()
  @IsUUID()
  defaultRepairLocationId?: string;

  @IsOptional()
  @IsUUID()
  defaultPartsLocationId?: string;

  @IsOptional()
  @IsBoolean()
  defaultQualityInspectionRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultWarrantyDurationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultServiceSlaHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  defaultLaborRate?: number;

  @IsOptional()
  @IsUUID()
  defaultServiceRevenueAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultWarrantyExpenseAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultServicePartsExpenseAccountId?: string;

  @IsOptional()
  @IsBoolean()
  autoCreateQualityInspection?: boolean;
}
