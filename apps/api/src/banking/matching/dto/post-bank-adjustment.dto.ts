import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class PostBankAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['BANK_CHARGE', 'BANK_INTEREST', 'OTHER'])
  adjustmentType!: 'BANK_CHARGE' | 'BANK_INTEREST' | 'OTHER';

  @IsUUID()
  expenseOrIncomeAccountId!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;
}
