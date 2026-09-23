import { IsOptional, IsDateString, IsUUID } from 'class-validator';

export class ServiceReportQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  technicianId?: string;
}
