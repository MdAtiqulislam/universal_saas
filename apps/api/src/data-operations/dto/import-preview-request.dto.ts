import { IsString, IsOptional, IsIn, IsEnum, IsBoolean } from 'class-validator';
import { DataImportMode, DataDuplicateStrategy } from '@prisma/client';

export class ImportPreviewRequestDto {
  @IsString()
  operationKey!: string;

  @IsString()
  fileContent!: string;

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
  @IsBoolean()
  dryRun?: boolean;
}
