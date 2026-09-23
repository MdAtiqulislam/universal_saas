import {
  IsOptional,
  IsUUID,
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaxScope } from '@prisma/client';

export class TaxReportQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  @IsOptional()
  taxCodeId?: string;

  @IsUUID()
  @IsOptional()
  jurisdictionId?: string;

  @IsEnum(TaxScope)
  @IsOptional()
  taxScope?: TaxScope;

  @IsString()
  @IsOptional()
  sourceType?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
