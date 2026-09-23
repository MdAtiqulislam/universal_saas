import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateCompensationDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom!: string;

  @IsDateString()
  @IsOptional()
  effectiveUntil?: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  baseSalary!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  housingAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  transportAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  medicalAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  otherAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  overtimeRate?: number;

  @IsUUID()
  @IsOptional()
  paymentAccountId?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateCompensationDto {
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsDateString()
  @IsOptional()
  effectiveUntil?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  baseSalary?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  housingAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  transportAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  medicalAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  otherAllowance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  overtimeRate?: number;

  @IsUUID()
  @IsOptional()
  paymentAccountId?: string | null;

  @IsUUID()
  @IsOptional()
  currencyId?: string | null;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
