import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UsageExportDto {
  @IsOptional()
  @IsString()
  apiKeyId?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number = 30;

  @IsOptional()
  @IsString()
  format?: string = 'csv';
}
