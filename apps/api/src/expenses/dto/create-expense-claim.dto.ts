import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseClaimLineDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsDateString()
  expenseDate!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsUUID()
  @IsOptional()
  taxCodeId?: string;

  @IsUUID()
  @IsOptional()
  glAccountId?: string;

  @IsString()
  @IsOptional()
  receiptReference?: string;

  @IsString()
  @IsOptional()
  receiptFilename?: string;

  @IsString()
  @IsOptional()
  receiptMimeType?: string;
}

export class CreateExpenseClaimDto {
  @IsUUID()
  claimantId!: string;

  @IsDateString()
  claimDate!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsUUID()
  currencyId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExpenseClaimLineDto)
  lines!: CreateExpenseClaimLineDto[];
}
