import { IsString, IsOptional } from 'class-validator';

export class UpdateWarehouseConfigDto {
  @IsString()
  @IsOptional()
  defaultReceivingLocationId?: string;

  @IsString()
  @IsOptional()
  defaultStagingLocationId?: string;

  @IsString()
  @IsOptional()
  defaultQuarantineLocationId?: string;

  @IsString()
  @IsOptional()
  defaultScrapLocationId?: string;

  @IsString()
  @IsOptional()
  defaultReturnLocationId?: string;

  @IsString()
  @IsOptional()
  defaultPickLocationId?: string;
}
