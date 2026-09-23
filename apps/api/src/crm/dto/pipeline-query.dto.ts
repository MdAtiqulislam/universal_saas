import { IsOptional, IsString, IsDateString } from 'class-validator';

export class PipelineForecastQueryDto {
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
