import {
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
  IsObject,
} from 'class-validator';
import { SearchScope } from '@prisma/client';

export class CreateRecentItemDto {
  @IsString()
  @MaxLength(100)
  resourceType!: string;

  @IsString()
  @MaxLength(100)
  resourceId!: string;

  @IsOptional()
  @IsEnum(SearchScope)
  scope?: SearchScope = SearchScope.GLOBAL;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitle?: string;

  @IsString()
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateFavoriteItemDto {
  @IsString()
  @MaxLength(100)
  resourceType!: string;

  @IsString()
  @MaxLength(100)
  resourceId!: string;

  @IsOptional()
  @IsEnum(SearchScope)
  scope?: SearchScope = SearchScope.GLOBAL;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitle?: string;

  @IsString()
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
