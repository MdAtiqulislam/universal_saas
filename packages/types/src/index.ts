/**
 * Universal SaaS — Shared Foundational Types
 * Common primitives, envelopes, and utility types used across api, web, and packages.
 */

export type Nullable<T> = T | null;

export type SortOrder = "asc" | "desc";

export interface BaseEntity {
  id: string;
}

export interface TimestampedEntity extends BaseEntity {
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
  path?: string;
}
