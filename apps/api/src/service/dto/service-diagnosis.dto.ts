import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export class RecordDiagnosisDto {
  @IsNotEmpty()
  @IsUUID()
  technicianId!: string;

  @IsNotEmpty()
  @IsString()
  diagnosisCode!: string;

  @IsNotEmpty()
  @IsString()
  symptoms!: string;

  @IsNotEmpty()
  @IsString()
  rootCause!: string;

  @IsOptional()
  @IsBoolean()
  repairRecommended?: boolean;

  @IsOptional()
  @IsBoolean()
  replacementRecommended?: boolean;

  @IsOptional()
  @IsBoolean()
  warrantyCovered?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  finalize?: boolean;
}
