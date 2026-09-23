import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerRefundDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  @IsOptional()
  creditNoteId?: string;

  @IsUUID()
  paymentAccountId!: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsDateString()
  refundDate!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  amount!: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
