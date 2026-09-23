import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ItemType, TrackingType } from '@prisma/client';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  sku!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

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
  @IsNotEmpty()
  unitId!: string;

  @IsEnum(ItemType)
  @IsOptional()
  itemType?: ItemType;

  @IsEnum(TrackingType)
  @IsOptional()
  trackingType?: TrackingType;
}
