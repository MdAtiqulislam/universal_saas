import { IsEnum, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportShareType } from '@prisma/client';

export class CreateReportShareDto {
  @IsEnum(ReportShareType)
  shareType!: ReportShareType;

  @IsString()
  targetId!: string;
}

export class BulkReportShareDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReportShareDto)
  shares!: CreateReportShareDto[];
}
