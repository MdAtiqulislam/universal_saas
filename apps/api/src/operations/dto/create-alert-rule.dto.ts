import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { AlertSeverity } from '@prisma/client';

export class CreateAlertRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  metricKey!: string;

  @IsNumber()
  threshold!: number;

  @IsNumber()
  @Min(1)
  windowSeconds!: number;

  @IsEnum(AlertSeverity)
  severity!: AlertSeverity;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cooldownSeconds?: number;
}
