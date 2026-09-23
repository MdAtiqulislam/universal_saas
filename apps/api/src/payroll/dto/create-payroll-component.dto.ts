import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PayrollComponentType, PayrollCalculationType } from '@prisma/client';

export class CreatePayrollComponentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEnum(PayrollComponentType)
  @IsNotEmpty()
  componentType!: PayrollComponentType;

  @IsEnum(PayrollCalculationType)
  @IsOptional()
  calculationType?: PayrollCalculationType;

  @IsBoolean()
  @IsOptional()
  taxable?: boolean;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsUUID()
  @IsOptional()
  expenseAccountId?: string;

  @IsUUID()
  @IsOptional()
  liabilityAccountId?: string;
}

export class UpdatePayrollComponentDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsEnum(PayrollComponentType)
  @IsOptional()
  componentType?: PayrollComponentType;

  @IsEnum(PayrollCalculationType)
  @IsOptional()
  calculationType?: PayrollCalculationType;

  @IsBoolean()
  @IsOptional()
  taxable?: boolean;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsUUID()
  @IsOptional()
  expenseAccountId?: string | null;

  @IsUUID()
  @IsOptional()
  liabilityAccountId?: string | null;
}
