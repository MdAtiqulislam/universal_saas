import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { AlertSeverity, AlertRuleStatus } from '@prisma/client';

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  metricKey?: string;

  @IsOptional()
  @IsNumber()
  threshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  windowSeconds?: number;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @IsOptional()
  @IsEnum(AlertRuleStatus)
  status?: AlertRuleStatus;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cooldownSeconds?: number;
}
