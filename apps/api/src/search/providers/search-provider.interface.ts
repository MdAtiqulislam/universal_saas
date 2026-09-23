import { SearchScope } from '@prisma/client';
import { FilterNode } from '../dto/filter-ast.dto';

export interface SearchRecord {
  id: string;
  resourceType: string;
  scope: SearchScope;
  title: string;
  subtitle?: string;
  description?: string;
  status?: string;
  url: string;
  metadata?: Record<string, unknown>;
  score?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SuggestionItem {
  id: string;
  resourceType: string;
  scope: SearchScope;
  title: string;
  subtitle?: string;
  url: string;
  matchType: 'recent' | 'exact' | 'prefix' | 'entity';
}

export interface ProviderSearchParams {
  organizationId: string;
  query?: string;
  filters?: FilterNode;
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProviderSuggestParams {
  organizationId: string;
  query: string;
  limit: number;
}

export interface SearchProvider {
  readonly resourceType: string;
  readonly scope: SearchScope;
  readonly displayName: string;
  readonly requiredPermission: string;
  readonly searchableFields: string[];
  readonly filterableFields: string[];

  search(params: ProviderSearchParams): Promise<SearchRecord[]>;
  suggest(params: ProviderSuggestParams): Promise<SuggestionItem[]>;
  count(params: ProviderSearchParams): Promise<number>;
}
