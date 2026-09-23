import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetPeriodType, BudgetControlPolicy } from '@prisma/client';
import { CreateBudgetLineDto } from './create-budget-line.dto';

export class CreateBudgetDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  budgetNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsNotEmpty()
  fiscalYear!: number;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsUUID()
  @IsNotEmpty()
  currencyId!: string;

  @IsEnum(BudgetPeriodType)
  @IsOptional()
  periodType?: BudgetPeriodType;

  @IsEnum(BudgetControlPolicy)
  @IsOptional()
  controlPolicy?: BudgetControlPolicy;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  warnThresholdPercent?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetLineDto)
  @IsOptional()
  lines?: CreateBudgetLineDto[];
}
