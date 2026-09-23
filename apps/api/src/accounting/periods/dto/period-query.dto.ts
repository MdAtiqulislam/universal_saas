import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { FiscalPeriodStatus } from '@prisma/client';

export class FiscalPeriodQueryDto {
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
  limit?: number = 20;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  @IsEnum(FiscalPeriodStatus)
  @IsOptional()
  status?: FiscalPeriodStatus;
}
