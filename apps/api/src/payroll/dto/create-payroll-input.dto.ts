import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PayrollInputType } from '@prisma/client';

export class CreatePayrollInputDto {
  @IsUUID()
  @IsNotEmpty()
  payrollPeriodId!: string;

  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsEnum(PayrollInputType)
  @IsNotEmpty()
  inputType!: PayrollInputType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sourceReference?: string;
}
