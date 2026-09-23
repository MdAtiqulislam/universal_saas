import { Injectable, BadRequestException } from '@nestjs/common';
import {
  PaginationQueryDto,
  CursorPaginationQueryDto,
  PaginatedResult,
  CursorPaginatedResult,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
} from './pagination.dto';

export interface CursorPayload {
  id: string;
  createdAt: string;
}

@Injectable()
export class PaginationService {
  encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  decodeCursor(cursor: string): CursorPayload {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (!parsed.id || !parsed.createdAt) {
        throw new Error('Invalid cursor schema');
      }
      return parsed;
    } catch {
      throw new BadRequestException('Malformed or invalid pagination cursor.');
    }
  }

  clampLimit(requestedLimit?: number): number {
    if (!requestedLimit || requestedLimit < 1) return DEFAULT_PAGE_SIZE;
    return Math.min(requestedLimit, MAX_PAGE_SIZE);
  }

  buildPaginatedResult<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  buildCursorResult<T extends { id: string; createdAt: Date }>(
    items: T[],
    limit: number,
  ): CursorPaginatedResult<T> {
    const hasNextPage = items.length > limit;
    const data = hasNextPage ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    if (hasNextPage && data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = this.encodeCursor({
        id: lastItem.id,
        createdAt: lastItem.createdAt.toISOString(),
      });
    }

    return {
      data,
      meta: {
        limit,
        nextCursor,
        hasNextPage,
      },
    };
  }
}
