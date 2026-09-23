import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';

export enum SecurityEventCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  SESSION = 'SESSION',
  TENANT_SECURITY = 'TENANT_SECURITY',
  API_ABUSE = 'API_ABUSE',
  DATA_ACCESS = 'DATA_ACCESS',
  ADMINISTRATION = 'ADMINISTRATION',
  CONFIGURATION = 'CONFIGURATION',
  INTEGRATION = 'INTEGRATION',
  SYSTEM_SECURITY = 'SYSTEM_SECURITY',
}

export enum SecurityEventSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class CreateSecurityEventDto {
  @IsEnum(SecurityEventCategory)
  category!: SecurityEventCategory;

  @IsString()
  eventType!: string;

  @IsOptional()
  @IsEnum(SecurityEventSeverity)
  severity?: SecurityEventSeverity = SecurityEventSeverity.INFO;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  details?: any;
}

export class SecurityEventQueryDto {
  @IsOptional()
  @IsEnum(SecurityEventCategory)
  category?: SecurityEventCategory;

  @IsOptional()
  @IsEnum(SecurityEventSeverity)
  severity?: SecurityEventSeverity;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
