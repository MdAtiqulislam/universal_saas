import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePutawayTaskLineDto {
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

  @IsString()
  @IsOptional()
  suggestedLocationId?: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;
}

export class CreatePutawayTaskDto {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsString()
  @IsNotEmpty()
  sourceLocationId!: string;

  @IsString()
  @IsOptional()
  targetLocationId?: string;

  @IsString()
  @IsOptional()
  sourceDocumentType?: string; // GOODS_RECEIPT, PRODUCTION_OUTPUT, RETURN

  @IsString()
  @IsOptional()
  sourceDocumentId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  priority?: number = 1;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePutawayTaskLineDto)
  lines!: CreatePutawayTaskLineDto[];
}

export class AssignPutawayTaskDto {
  @IsString()
  @IsNotEmpty()
  assignedUserId!: string;
}

export class CompletePutawayLineDto {
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @IsString()
  @IsNotEmpty()
  actualLocationId!: string;
}

export class CompletePutawayTaskDto {
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CompletePutawayLineDto)
  lines?: CompletePutawayLineDto[];

  @IsString()
  @IsOptional()
  targetLocationId?: string;
}

export class PutawayQueryDto {
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

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
