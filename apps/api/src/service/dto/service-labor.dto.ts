import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordServiceLaborDto {
  @IsNotEmpty()
  @IsUUID()
  employeeId!: string;

  @IsNotEmpty()
  @IsDateString()
  workDate!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  billableHours!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  actualHours!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  laborRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  internalCostRate?: number;

  @IsOptional()
  @IsBoolean()
  warrantyCovered?: boolean;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsBoolean()
  isFinalized?: boolean;
}

export class UpdateServiceLaborDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  billableHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  actualHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  laborRate?: number;

  @IsOptional()
  @IsBoolean()
  warrantyCovered?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isFinalized?: boolean;
}
