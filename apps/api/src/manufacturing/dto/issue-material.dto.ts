import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';

export class IssueMaterialDto {
  @IsUUID()
  @IsNotEmpty()
  productionOrderLineId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsUUID()
  @IsOptional()
  batchId?: string;

  @IsUUID()
  @IsOptional()
  serialId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serialNumbers?: string[];
}
