import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsDateString,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class StatementTransactionItemDto {
  @IsDateString()
  transactionDate!: string;

  @IsDateString()
  @IsOptional()
  valueDate?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reference?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  externalTransactionId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  debitAmount?: number = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  creditAmount?: number = 0;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  runningBalance?: number;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ImportStatementTransactionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StatementTransactionItemDto)
  transactions!: StatementTransactionItemDto[];
}
