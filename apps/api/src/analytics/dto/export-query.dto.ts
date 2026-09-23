import {
  IsEnum,
  ValidateNested,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExportFormat } from '@prisma/client';
import { AnalyticsQueryDto } from './analytics-query.dto';

export class ExportQueryDto {
  @IsEnum(ExportFormat)
  format!: ExportFormat;

  @ValidateNested()
  @Type(() => AnalyticsQueryDto)
  query!: AnalyticsQueryDto;

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  maxRows?: number = 1000;
}
