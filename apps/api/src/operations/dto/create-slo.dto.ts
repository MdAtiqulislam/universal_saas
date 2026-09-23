import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { SloScope } from '@prisma/client';

export class CreateSloDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  metricKey!: string;

  @IsEnum(SloScope)
  scope!: SloScope;

  @IsNumber()
  targetValue!: number;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(1)
  windowDays!: number;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
