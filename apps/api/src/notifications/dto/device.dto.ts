import { IsEnum, IsString, IsOptional } from 'class-validator';
import { PushPlatform } from '@prisma/client';

export class RegisterPushDeviceDto {
  @IsEnum(PushPlatform)
  platform!: PushPlatform;

  @IsString()
  deviceToken!: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
