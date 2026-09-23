import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class BudgetControlCheckDto {
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount!: number;

  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @IsUUID()
  @IsOptional()
  budgetId?: string;
}
