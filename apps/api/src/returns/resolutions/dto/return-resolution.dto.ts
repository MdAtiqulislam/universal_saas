import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCreditNoteResolutionDto {
  @IsUUID()
  @IsOptional()
  returnLineId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  quantity?: number;

  @IsUUID()
  @IsOptional()
  existingCreditNoteId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateRefundResolutionDto {
  @IsUUID()
  @IsOptional()
  returnLineId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsUUID()
  @IsOptional()
  creditNoteId?: string;

  @IsUUID()
  @IsOptional()
  paymentAccountId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateDebitNoteResolutionDto {
  @IsUUID()
  @IsOptional()
  returnLineId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  quantity?: number;

  @IsUUID()
  @IsOptional()
  existingDebitNoteId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateReplacementResolutionDto {
  @IsUUID()
  @IsNotEmpty()
  returnLineId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsUUID()
  @IsOptional()
  replacementSalesOrderId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  replacementReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
