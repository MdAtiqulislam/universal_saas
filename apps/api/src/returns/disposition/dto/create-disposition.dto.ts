import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnDispositionType } from '@prisma/client';

export class DispositionItemDto {
  @IsUUID()
  @IsNotEmpty()
  returnLineId!: string;

  @IsEnum(ReturnDispositionType)
  @IsNotEmpty()
  dispositionType!: ReturnDispositionType;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsOptional()
  referenceNotes?: string;
}

export class CreateReturnDispositionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DispositionItemDto)
  dispositions!: DispositionItemDto[];
}
