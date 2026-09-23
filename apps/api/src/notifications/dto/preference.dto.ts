import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class UpdatePreferenceDto {
  @IsString()
  eventCategory!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdatePolicyDto {
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsBoolean()
  allowed!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsBoolean()
  requireSecurityOverride?: boolean;
}
