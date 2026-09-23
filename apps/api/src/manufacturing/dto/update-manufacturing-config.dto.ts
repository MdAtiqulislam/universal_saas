import { IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class UpdateManufacturingConfigDto {
  @IsOptional()
  @IsUUID()
  wipAccountId?: string;

  @IsOptional()
  @IsUUID()
  rawMaterialAccountId?: string;

  @IsOptional()
  @IsUUID()
  finishedGoodsAccountId?: string;

  @IsOptional()
  @IsUUID()
  laborAccountId?: string;

  @IsOptional()
  @IsUUID()
  overheadAccountId?: string;

  @IsOptional()
  @IsUUID()
  varianceAccountId?: string;

  @IsOptional()
  @IsBoolean()
  allowReleaseOnShortage?: boolean;

  @IsOptional()
  @IsUUID()
  defaultLocationId?: string;
}
