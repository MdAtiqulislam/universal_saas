import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetReportQueryDto {
  @IsOptional()
  @IsString()
  budgetId?: string;

  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  fiscalYear?: number;
}
