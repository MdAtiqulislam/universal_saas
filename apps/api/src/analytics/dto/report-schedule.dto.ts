import {
  IsEnum,
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ReportScheduleFrequency, ExportFormat } from '@prisma/client';

export class CreateReportScheduleDto {
  @IsUUID()
  savedReportId!: string;

  @IsEnum(ReportScheduleFrequency)
  frequency!: ReportScheduleFrequency;

  @IsString()
  @IsOptional()
  cronExpression?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipients?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  channels?: string[];

  @IsEnum(ExportFormat)
  @IsOptional()
  exportFormat?: ExportFormat = ExportFormat.CSV;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class UpdateReportScheduleDto {
  @IsEnum(ReportScheduleFrequency)
  @IsOptional()
  frequency?: ReportScheduleFrequency;

  @IsString()
  @IsOptional()
  cronExpression?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipients?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  channels?: string[];

  @IsEnum(ExportFormat)
  @IsOptional()
  exportFormat?: ExportFormat;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
