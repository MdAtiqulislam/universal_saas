import {
  IsNumber,
  Min,
  IsOptional,
  IsUUID,
  IsString,
  IsArray,
} from 'class-validator';

export class CompleteProductionDto {
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  scrapQuantity?: number;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serialNumbers?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  laborCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  overheadCost?: number;
}
