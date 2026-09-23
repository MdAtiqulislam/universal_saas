import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBomLineDto } from './create-bom.dto';

export class UpdateBomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  quantity?: number;

  @IsUUID()
  @IsOptional()
  uomId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  version?: number;

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsDateString()
  @IsOptional()
  effectiveUntil?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBomLineDto)
  @IsOptional()
  lines?: CreateBomLineDto[];
}
