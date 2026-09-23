import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsEmail,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateExpenseClaimantDto {
  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  employeeNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  department?: string;

  @IsUUID()
  @IsOptional()
  defaultPaymentAccountId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
