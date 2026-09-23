import { IsOptional, IsDateString, IsString } from 'class-validator';

export class CrmReportFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  ownerEmployeeId?: string;
}
