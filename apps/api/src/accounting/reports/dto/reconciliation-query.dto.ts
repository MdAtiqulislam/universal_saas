import { IsOptional, IsString, IsDateString } from 'class-validator';

export class ReconciliationQueryDto {
  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
