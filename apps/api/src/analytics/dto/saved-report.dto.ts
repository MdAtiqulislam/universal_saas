import {
  IsString,
  IsArray,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsEnum,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReportVisibility } from '@prisma/client';
import { MeasureQueryItem, type FilterNode } from './analytics-query.dto';

export class CreateSavedReportDto {
  @IsString()
  definitionKey!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dimensions?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeasureQueryItem)
  @IsOptional()
  measures?: MeasureQueryItem[];

  @IsObject()
  @IsOptional()
  filterAst?: FilterNode;

  @IsString()
  @IsOptional()
  timeDimension?: string;

  @IsString()
  @IsOptional()
  timeGranularity?: string;

  @IsString()
  @IsOptional()
  timeZone?: string = 'UTC';

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  limit?: number = 50;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortDirection?: 'asc' | 'desc' = 'asc';

  @IsEnum(ReportVisibility)
  @IsOptional()
  visibility?: ReportVisibility = ReportVisibility.PRIVATE;
}

export class UpdateSavedReportDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dimensions?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeasureQueryItem)
  @IsOptional()
  measures?: MeasureQueryItem[];

  @IsObject()
  @IsOptional()
  filterAst?: FilterNode;

  @IsString()
  @IsOptional()
  timeDimension?: string;

  @IsString()
  @IsOptional()
  timeGranularity?: string;

  @IsString()
  @IsOptional()
  timeZone?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortDirection?: 'asc' | 'desc';

  @IsEnum(ReportVisibility)
  @IsOptional()
  visibility?: ReportVisibility;
}

export class QuerySavedReportsDto {
  @IsString()
  @IsOptional()
  definitionKey?: string;

  @IsEnum(ReportVisibility)
  @IsOptional()
  visibility?: ReportVisibility;

  @IsString()
  @IsOptional()
  search?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
