import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InspectionType, CharacteristicDataType } from '@prisma/client';

export class CreateCharacteristicDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  sequence?: number;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CharacteristicDataType)
  dataType!: CharacteristicDataType;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minSpec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxSpec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tolerance?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsString()
  acceptanceCriteria?: string;
}

export class CreateInspectionPlanDto {
  @IsOptional()
  @IsString()
  planNumber?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsEnum(InspectionType)
  inspectionType!: InspectionType;

  @IsOptional()
  @IsUUID()
  samplingPlanId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  effectiveFrom?: string;

  @IsOptional()
  effectiveTo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCharacteristicDto)
  characteristics?: CreateCharacteristicDto[];
}

export class UpdateInspectionPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  samplingPlanId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  effectiveFrom?: string | null;

  @IsOptional()
  effectiveTo?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCharacteristicDto)
  characteristics?: CreateCharacteristicDto[];
}

export class QueryInspectionPlansDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsEnum(InspectionType)
  inspectionType?: InspectionType;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}
