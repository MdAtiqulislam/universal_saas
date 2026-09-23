import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ItemType, TrackingType } from '@prisma/client';

export class UpdateItemDto {
  @IsString()
  @IsOptional()
  @Length(2, 200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsEnum(ItemType)
  @IsOptional()
  itemType?: ItemType;

  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
