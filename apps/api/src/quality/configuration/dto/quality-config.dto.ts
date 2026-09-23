import { IsEnum, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { InspectionType } from '@prisma/client';

export class UpdateQualityConfigDto {
  @IsOptional()
  @IsEnum(InspectionType)
  defaultInspectionType?: InspectionType;

  @IsOptional()
  @IsBoolean()
  autoCreateIncomingLots?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCreateFinishedGoodsLots?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCreateOutgoingLots?: boolean;

  @IsOptional()
  @IsBoolean()
  holdOnFailure?: boolean;

  @IsOptional()
  @IsBoolean()
  requireAllMandatoryCharacteristics?: boolean;

  @IsOptional()
  @IsUUID()
  defaultSamplingPlanId?: string | null;
}
