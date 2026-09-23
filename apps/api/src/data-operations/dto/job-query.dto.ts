import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DataOperationStatus, DataOperationType } from '@prisma/client';

export class JobQueryDto {
  @IsOptional()
  @IsEnum(DataOperationStatus)
  status?: DataOperationStatus;

  @IsOptional()
  @IsEnum(DataOperationType)
  operationType?: DataOperationType;

  @IsOptional()
  @IsString()
  operationKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
