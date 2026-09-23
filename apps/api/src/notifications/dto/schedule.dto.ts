import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class CreateScheduleDto {
  @IsString()
  templateKey!: string;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels!: NotificationChannel[];

  @IsArray()
  @IsString({ each: true })
  recipientIds!: string[];

  @IsDateString()
  sendAt!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class BulkNotificationDto {
  @IsString()
  eventType!: string;

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels!: NotificationChannel[];

  @IsArray()
  @IsString({ each: true })
  recipientIds!: string[];

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  batchSize?: number;
}
