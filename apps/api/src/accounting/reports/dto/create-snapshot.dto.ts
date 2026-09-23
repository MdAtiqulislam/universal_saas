import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportSnapshotType } from '@prisma/client';

export class CreateReportSnapshotDto {
  @IsNotEmpty()
  @IsEnum(ReportSnapshotType)
  reportType!: ReportSnapshotType;

  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsOptional()
  reportParameters?: Record<string, unknown>;

  @IsOptional()
  reportData?: Record<string, unknown>;
}
