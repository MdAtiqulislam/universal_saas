import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IncidentStatus, IncidentSeverity } from '@prisma/client';

export class IncidentQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;
}
