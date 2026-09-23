import { IsString, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { BillingQuotaType } from '@prisma/client';

export class RecordUsageDto {
  @IsString()
  metricKey!: string;

  @IsInt()
  @Min(1)
  quantity: number = 1;

  @IsOptional()
  @IsString()
  source?: string = 'api';

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class UsageQueryDto {
  @IsOptional()
  @IsString()
  metricKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SetQuotaDto {
  @IsString()
  metricKey!: string;

  @IsEnum(BillingQuotaType)
  quotaType: BillingQuotaType = BillingQuotaType.HARD_LIMIT;

  @IsInt()
  @Min(0)
  allocatedAmount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  authorizedOverride?: number;

  @IsOptional()
  @IsString()
  overrideReason?: string;
}
