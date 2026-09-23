import { IsString, IsOptional } from 'class-validator';

export class WarehouseReportsQueryDto {
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}
