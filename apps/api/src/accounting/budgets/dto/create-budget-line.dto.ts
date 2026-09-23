import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsString,
  IsDateString,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { BudgetCategory } from '@prisma/client';

export class CreateBudgetLineDto {
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @IsEnum(BudgetCategory)
  @IsOptional()
  category?: BudgetCategory;

  @IsUUID()
  @IsOptional()
  fiscalPeriodId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  period!: string; // e.g. "2026-01", "2026-Q1", "2026"

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
