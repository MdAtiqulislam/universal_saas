import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestReturnInspectionDto {
  @IsUUID()
  @IsOptional()
  inspectionPlanId?: string;

  @IsUUID()
  @IsOptional()
  samplingPlanId?: string;

  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
