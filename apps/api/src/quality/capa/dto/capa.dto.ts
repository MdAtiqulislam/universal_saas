import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { CapaStatus } from '@prisma/client';

export class CreateCapaDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsUUID()
  nonConformanceId?: string;

  @IsOptional()
  @IsUUID()
  sourceInspectionLotId?: string;

  @IsOptional()
  @IsString()
  rootCauseAnalysis?: string;

  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @IsOptional()
  @IsString()
  preventiveAction?: string;

  @IsOptional()
  targetDate?: string;
}

export class UpdateCapaDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  rootCauseAnalysis?: string;

  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @IsOptional()
  @IsString()
  preventiveAction?: string;

  @IsOptional()
  targetDate?: string;
}

export class VerifyCapaDto {
  @IsString()
  @IsNotEmpty()
  verificationNotes!: string;

  @IsOptional()
  @IsString()
  effectivenessReview?: string;
}

export class QueryCapaDto {
  @IsOptional()
  @IsEnum(CapaStatus)
  status?: CapaStatus;

  @IsOptional()
  @IsUUID()
  nonConformanceId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
