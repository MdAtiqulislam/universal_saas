import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DashboardVisibility,
  DashboardWidgetType,
  ReportShareType,
} from '@prisma/client';

export class CreateDashboardDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DashboardVisibility)
  @IsOptional()
  visibility?: DashboardVisibility = DashboardVisibility.PRIVATE;

  @IsObject()
  @IsOptional()
  layout?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean = false;
}

export class UpdateDashboardDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DashboardVisibility)
  @IsOptional()
  visibility?: DashboardVisibility;

  @IsObject()
  @IsOptional()
  layout?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class CreateDashboardWidgetDto {
  @IsUUID()
  @IsOptional()
  savedReportId?: string;

  @IsString()
  title!: string;

  @IsEnum(DashboardWidgetType)
  widgetType!: DashboardWidgetType;

  @IsObject()
  position!: { x: number; y: number; w: number; h: number };

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class UpdateDashboardWidgetDto {
  @IsUUID()
  @IsOptional()
  savedReportId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(DashboardWidgetType)
  @IsOptional()
  widgetType?: DashboardWidgetType;

  @IsObject()
  @IsOptional()
  position?: { x: number; y: number; w: number; h: number };

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class CreateDashboardShareDto {
  @IsEnum(ReportShareType)
  shareType!: ReportShareType;

  @IsString()
  targetId!: string;
}

export class BulkDashboardShareDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDashboardShareDto)
  shares!: CreateDashboardShareDto[];
}
