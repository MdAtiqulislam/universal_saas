import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
  IsObject,
} from 'class-validator';
import { SearchScope, SavedViewVisibility } from '@prisma/client';

export class CreateSavedViewDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MaxLength(100)
  resourceType!: string;

  @IsOptional()
  @IsEnum(SearchScope)
  scope?: SearchScope = SearchScope.GLOBAL;

  @IsOptional()
  @IsEnum(SavedViewVisibility)
  visibility?: SavedViewVisibility = SavedViewVisibility.PERSONAL;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  sorting?: { field: string; order: 'asc' | 'desc' }[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedColumns?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(256)
  searchText?: string;

  @IsOptional()
  @IsObject()
  paginationDefaults?: { limit?: number; sortBy?: string };

  @IsOptional()
  @IsObject()
  displayConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateSavedViewDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(SavedViewVisibility)
  visibility?: SavedViewVisibility;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  sorting?: { field: string; order: 'asc' | 'desc' }[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedColumns?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(256)
  searchText?: string;

  @IsOptional()
  @IsObject()
  paginationDefaults?: { limit?: number; sortBy?: string };

  @IsOptional()
  @IsObject()
  displayConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

export class QuerySavedViewsDto {
  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsEnum(SearchScope)
  scope?: SearchScope;

  @IsOptional()
  @IsEnum(SavedViewVisibility)
  visibility?: SavedViewVisibility;

  @IsOptional()
  @IsString()
  search?: string;
}
