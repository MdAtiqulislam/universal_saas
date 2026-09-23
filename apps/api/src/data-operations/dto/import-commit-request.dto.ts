import {
  IsString,
  IsOptional,
  IsIn,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { DataImportMode, DataDuplicateStrategy } from '@prisma/client';

export class ImportCommitRequestDto {
  @IsString()
  operationKey!: string;

  @IsString()
  fileContent!: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsIn(['CSV', 'JSON'])
  format?: 'CSV' | 'JSON';

  @IsOptional()
  @IsEnum(DataImportMode)
  mode?: DataImportMode;

  @IsOptional()
  @IsEnum(DataDuplicateStrategy)
  duplicateStrategy?: DataDuplicateStrategy;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(500)
  batchSize?: number;
}
