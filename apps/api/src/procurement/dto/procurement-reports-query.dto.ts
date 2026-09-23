import { IsOptional, IsUUID, IsDateString, IsString } from 'class-validator';

export class ProcurementReportsQueryDto {
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  groupBy?: 'supplier' | 'item' | 'category' | 'location' | 'month';
}
