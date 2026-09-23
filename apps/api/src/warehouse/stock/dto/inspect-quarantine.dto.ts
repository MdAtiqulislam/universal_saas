import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { QuarantineStatus } from '@prisma/client';

export class InspectQuarantineDto {
  @IsEnum(QuarantineStatus)
  status!: QuarantineStatus;

  @IsString()
  @IsNotEmpty()
  disposition!: string; // RELEASE, HOLD, SCRAP, RETURN

  @IsString()
  @IsOptional()
  dispositionNotes?: string;
}

export class ReleaseQuarantineDto {
  @IsString()
  @IsOptional()
  targetLocationId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QuarantineQueryDto {
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  itemId?: string;

  @IsEnum(QuarantineStatus)
  @IsOptional()
  status?: QuarantineStatus;

  @IsString()
  @IsOptional()
  search?: string;
}
