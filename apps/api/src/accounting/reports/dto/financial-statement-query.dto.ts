import { IsOptional, IsDateString, IsUUID } from 'class-validator';

export class FinancialStatementQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsDateString()
  @IsOptional()
  asOfDate?: string;

  @IsUUID()
  @IsOptional()
  fiscalPeriodId?: string;
}
