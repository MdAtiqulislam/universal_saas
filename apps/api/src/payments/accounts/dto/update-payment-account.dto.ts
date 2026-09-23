import {
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentAccountType } from '@prisma/client';

export class UpdatePaymentAccountDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsEnum(PaymentAccountType)
  @IsOptional()
  type?: PaymentAccountType;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsUUID()
  @IsOptional()
  accountingAccountId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
