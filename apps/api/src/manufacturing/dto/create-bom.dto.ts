import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBomLineDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsUUID()
  @IsNotEmpty()
  uomId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  scrapPercentage?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateBomDto {
  @IsString()
  @IsOptional()
  bomNumber?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  quantity?: number;

  @IsUUID()
  @IsNotEmpty()
  uomId!: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  version?: number;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom!: string;

  @IsDateString()
  @IsOptional()
  effectiveUntil?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBomLineDto)
  lines!: CreateBomLineDto[];
}
