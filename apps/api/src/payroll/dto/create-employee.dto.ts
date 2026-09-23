import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EmploymentStatus, EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  employeeNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

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
  @IsNotEmpty()
  hireDate!: string;

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
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  jobPositionId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  designation?: string;

  @IsUUID()
  @IsOptional()
  managerEmployeeId?: string;

  @IsUUID()
  @IsOptional()
  defaultPaymentAccountId?: string;

  @IsUUID()
  @IsOptional()
  payrollCurrencyId?: string;
}
