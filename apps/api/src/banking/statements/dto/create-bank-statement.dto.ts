import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateBankStatementDto {
  @IsUUID()
  paymentAccountId!: string;

  @IsDateString()
  statementDate!: string;

  @IsNumber()
  @Type(() => Number)
  openingBalance!: number;

  @IsNumber()
  @Type(() => Number)
  closingBalance!: number;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  source?: string;
}
