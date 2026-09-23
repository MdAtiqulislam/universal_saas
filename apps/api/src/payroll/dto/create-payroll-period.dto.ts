import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MaxLength,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollPeriodStatus, PayrollRunStatus } from '@prisma/client';

export class CreatePayrollPeriodDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  periodNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsDateString()
  @IsNotEmpty()
  paymentDate!: string;
}

export class PayrollPeriodQueryDto {
  @IsEnum(PayrollPeriodStatus)
  @IsOptional()
  status?: PayrollPeriodStatus;

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

export class PayrollRunQueryDto {
  @IsUUID()
  @IsOptional()
  payrollPeriodId?: string;

  @IsEnum(PayrollRunStatus)
  @IsOptional()
  status?: PayrollRunStatus;

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
