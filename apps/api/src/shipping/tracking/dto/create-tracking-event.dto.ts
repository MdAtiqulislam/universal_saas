import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ShipmentStatus, ShipmentTrackingEventType } from '@prisma/client';

export class CreateTrackingEventDto {
  @IsEnum(ShipmentStatus)
  @IsNotEmpty()
  status!: ShipmentStatus;

  @IsEnum(ShipmentTrackingEventType)
  @IsNotEmpty()
  eventType!: ShipmentTrackingEventType;

  @IsDateString()
  @IsOptional()
  eventTime?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  externalReference?: string;
}
