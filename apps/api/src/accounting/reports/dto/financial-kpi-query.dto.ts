import { IsOptional, IsString, IsDateString } from 'class-validator';

export class FinancialKpiQueryDto {
  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
