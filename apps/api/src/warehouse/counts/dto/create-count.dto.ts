import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCycleCountLineDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  serialId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  systemQuantity?: number;
}

export class CreateCycleCountDto {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsString()
  @IsOptional()
  zoneId?: string;

  @IsBoolean()
  @IsOptional()
  isBlind?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  assignedCounterUserId?: string;

  @IsString()
  @IsOptional()
  scheduledDate?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateCycleCountLineDto)
  lines?: CreateCycleCountLineDto[];
}

export class RecordCountLineDto {
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  countedQuantity!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecordCountDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordCountLineDto)
  lines!: RecordCountLineDto[];
}

export class RecountLineDto {
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  recountQuantity!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecountDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecountLineDto)
  lines!: RecountLineDto[];
}

export class CycleCountQueryDto {
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  zoneId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
