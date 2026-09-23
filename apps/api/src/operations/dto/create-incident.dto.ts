import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { IncidentSeverity, IncidentSource } from '@prisma/client';

export class CreateIncidentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;

  @IsEnum(IncidentSource)
  source!: IncidentSource;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsDateString()
  detectedAt?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}
