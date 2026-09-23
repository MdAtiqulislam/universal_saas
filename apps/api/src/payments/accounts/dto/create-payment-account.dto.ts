import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentAccountType } from '@prisma/client';

export class CreatePaymentAccountDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @IsEnum(PaymentAccountType)
  type!: PaymentAccountType;

  @IsUUID()
  currencyId!: string;

  @IsUUID()
  accountingAccountId!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
