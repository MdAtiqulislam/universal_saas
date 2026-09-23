import {
  IsEnum,
  IsUUID,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  IsString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaymentType } from '@prisma/client';

export class CreatePaymentDto {
  @IsEnum(PaymentType)
  type!: PaymentType;

  @IsUUID()
  paymentAccountId!: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsDateString()
  paymentDate!: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  amount!: number;

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
  notes?: string;
}
