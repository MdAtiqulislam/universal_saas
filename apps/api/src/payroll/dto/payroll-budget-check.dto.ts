import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class PayrollBudgetCheckDto {
  @IsUUID()
  @IsNotEmpty()
  payrollPeriodId!: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  estimatedAmount?: number;

  @IsDateString()
  @IsOptional()
  date?: string;
}
