import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SearchScope } from '@prisma/client';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  q?: string;

  @IsOptional()
  @IsEnum(SearchScope)
  scope?: SearchScope = SearchScope.GLOBAL;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resourceTypes?: string[];

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sortBy?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsBoolean()
  recordHistory?: boolean = true;
}

export class SearchSuggestionsDto {
  @IsString()
  @MaxLength(100)
  q!: string;

  @IsOptional()
  @IsEnum(SearchScope)
  scope?: SearchScope = SearchScope.GLOBAL;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}
