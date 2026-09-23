import {
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { PayrollFrequency, BudgetControlPolicy } from '@prisma/client';

export class UpdatePayrollConfigDto {
  @IsEnum(PayrollFrequency)
  @IsOptional()
  payrollFrequency?: PayrollFrequency;

  @IsUUID()
  @IsOptional()
  defaultCurrencyId?: string;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  workingDaysPerPeriod?: number;

  @IsNumber()
  @Min(1)
  @Max(24)
  @IsOptional()
  standardWorkingHours?: number;

  @IsBoolean()
  @IsOptional()
  overtimeEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  taxEnabled?: boolean;

  @IsEnum(BudgetControlPolicy)
  @IsOptional()
  budgetControlPolicy?: BudgetControlPolicy;

  @IsUUID()
  @IsOptional()
  payrollExpenseAccountId?: string | null;

  @IsUUID()
  @IsOptional()
  payrollPayableAccountId?: string | null;

  @IsUUID()
  @IsOptional()
  payrollTaxPayableAccountId?: string | null;

  @IsUUID()
  @IsOptional()
  overtimeExpenseAccountId?: string | null;
}
