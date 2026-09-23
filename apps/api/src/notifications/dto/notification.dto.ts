import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsObject,
} from 'class-validator';
import { NotificationPriority, NotificationChannel } from '@prisma/client';

export class SendNotificationDto {
  @IsString()
  eventType!: string;

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientDestinations?: string[];

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
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class QueryNotificationsDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class MarkReadDto {
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  recipientIds?: string[];
}
