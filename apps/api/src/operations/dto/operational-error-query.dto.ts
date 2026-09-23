import { IsEnum, IsOptional, IsUUID, IsInt, Min } from 'class-validator';
import {
  OperationalErrorCategory,
  OperationalErrorSeverity,
} from '@prisma/client';
import { Transform } from 'class-transformer';

export class OperationalErrorQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsEnum(OperationalErrorCategory)
  category?: OperationalErrorCategory;

  @IsOptional()
  @IsEnum(OperationalErrorSeverity)
  severity?: OperationalErrorSeverity;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : Number(value),
  )
  days?: number;
}
