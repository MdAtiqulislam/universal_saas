import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class ConfigureProviderDto {
  @IsString()
  providerKey!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  rawCredentials?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}

export class TestProviderDto {
  @IsString()
  providerKey!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsString()
  testDestination?: string;
}
