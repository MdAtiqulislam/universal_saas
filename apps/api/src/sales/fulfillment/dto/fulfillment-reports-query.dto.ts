import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsUUID,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SalesOrderStatus } from '@prisma/client';

export class FulfillmentReportsQueryDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsEnum(SalesOrderStatus)
  @IsOptional()
  status?: SalesOrderStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}
