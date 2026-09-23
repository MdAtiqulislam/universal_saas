import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetStatus, BudgetCategory } from '@prisma/client';

export class BudgetQueryDto {
  @IsEnum(BudgetStatus)
  @IsOptional()
  status?: BudgetStatus;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  fiscalYear?: number;

  @IsUUID()
  @IsOptional()
  accountId?: string;

  @IsEnum(BudgetCategory)
  @IsOptional()
  category?: BudgetCategory;

  @IsString()
  @IsOptional()
  period?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
