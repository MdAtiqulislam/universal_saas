import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { InspectionType } from '@prisma/client';

export class QualityReportsQueryDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsEnum(InspectionType)
  inspectionType?: InspectionType;

  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;
}
