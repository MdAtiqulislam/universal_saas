import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WarehouseTaskType } from '@prisma/client';

export class CreateWarehouseTaskDto {
  @IsEnum(WarehouseTaskType)
  taskType!: WarehouseTaskType;

  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsString()
  @IsOptional()
  sourceLocationId?: string;

  @IsString()
  @IsOptional()
  targetLocationId?: string;

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
  sourceDocumentType?: string;

  @IsString()
  @IsOptional()
  sourceDocumentId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateWarehouseTaskDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  priority?: number;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsString()
  @IsOptional()
  targetLocationId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AssignWarehouseTaskDto {
  @IsString()
  @IsNotEmpty()
  assignedUserId!: string;
}

export class WarehouseTaskQueryDto {
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsEnum(WarehouseTaskType)
  @IsOptional()
  taskType?: WarehouseTaskType;

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
