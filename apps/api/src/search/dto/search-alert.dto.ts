import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SearchAlertTriggerType, SearchAlertStatus } from '@prisma/client';

export class CreateSearchAlertDto {
  @IsString()
  savedViewId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEnum(SearchAlertTriggerType)
  triggerType?: SearchAlertTriggerType = SearchAlertTriggerType.NEW_MATCH;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  scheduleCron?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(10080) // up to 7 days
  alertIntervalMinutes?: number = 60;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyChannels?: string[] = ['IN_APP'];

  @IsOptional()
  @IsObject()
  channelConfig?: Record<string, unknown>;
}

export class UpdateSearchAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(SearchAlertTriggerType)
  triggerType?: SearchAlertTriggerType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(10080)
  alertIntervalMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  scheduleCron?: string;

  @IsOptional()
  @IsEnum(SearchAlertStatus)
  status?: SearchAlertStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyChannels?: string[];

  @IsOptional()
  @IsObject()
  channelConfig?: Record<string, unknown>;
}
