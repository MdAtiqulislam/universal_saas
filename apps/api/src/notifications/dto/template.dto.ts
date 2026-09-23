import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
} from 'class-validator';
import {
  NotificationChannel,
  NotificationTemplateStatus,
} from '@prisma/client';

export class CreateTemplateDto {
  @IsString()
  key!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(NotificationTemplateStatus)
  status?: NotificationTemplateStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  initialSubject?: string;

  @IsOptional()
  @IsString()
  initialBody?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsString()
  locale?: string;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(NotificationTemplateStatus)
  status?: NotificationTemplateStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateTemplateVersionDto {
  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];
}

export class RenderTemplateDto {
  @IsString()
  templateKey!: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsObject()
  variables!: Record<string, unknown>;
}
