import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EmploymentStatus, EmploymentType } from '@prisma/client';

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  displayName?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  nationalIdReference?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @IsDateString()
  @IsOptional()
  terminationDate?: string;

  @IsEnum(EmploymentStatus)
  @IsOptional()
  employmentStatus?: EmploymentStatus;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsUUID()
  @IsOptional()
  departmentId?: string | null;

  @IsUUID()
  @IsOptional()
  jobPositionId?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  designation?: string | null;

  @IsUUID()
  @IsOptional()
  managerEmployeeId?: string | null;

  @IsUUID()
  @IsOptional()
  defaultPaymentAccountId?: string | null;

  @IsUUID()
  @IsOptional()
  payrollCurrencyId?: string | null;
}
