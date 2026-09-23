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

export class CreatePickTaskLineDto {
  @IsString()
  @IsOptional()
  salesOrderLineId?: string;

  @IsString()
  @IsOptional()
  deliveryOrderLineId?: string;

  @IsString()
  @IsOptional()
  reservationId?: string;

  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsNotEmpty()
  sourceLocationId!: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  requestedQuantity!: number;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  serialId?: string;
}

export class CreatePickTaskDto {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsString()
  @IsOptional()
  salesOrderId?: string;

  @IsString()
  @IsOptional()
  deliveryOrderId?: string;

  @IsString()
  @IsOptional()
  stagingLocationId?: string;

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
  @Type(() => CreatePickTaskLineDto)
  lines!: CreatePickTaskLineDto[];
}

export class AssignPickTaskDto {
  @IsString()
  @IsNotEmpty()
  assignedUserId!: string;
}

export class ExecutePickLineDto {
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  pickedQuantity!: number;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  serialId?: string;
}

export class ExecutePickTaskDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecutePickLineDto)
  lines!: ExecutePickLineDto[];

  @IsString()
  @IsOptional()
  stagingLocationId?: string;
}

export class PickQueryDto {
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  salesOrderId?: string;

  @IsString()
  @IsOptional()
  deliveryOrderId?: string;

  @IsString()
  @IsOptional()
  waveId?: string;

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
