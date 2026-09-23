import { Injectable, ForbiddenException } from '@nestjs/common';
import { SearchHistoryRepository } from '../repositories/search-history.repository';
import { SearchScope } from '@prisma/client';

@Injectable()
export class SearchHistoryService {
  constructor(private readonly historyRepo: SearchHistoryRepository) {}

  async recordSearch(params: {
    organizationId: string;
    userId: string;
    queryText: string;
    scope?: SearchScope;
    filters?: Record<string, unknown>;
    resultCount: number;
  }) {
    if (!params.queryText || !params.queryText.trim()) return null;

    return this.historyRepo.recordHistory({
      organizationId: params.organizationId,
      userId: params.userId,
      queryText: params.queryText.trim(),
      scope: params.scope || SearchScope.GLOBAL,
      filters: params.filters,
      resultCount: params.resultCount,
    });
  }

  /**
   * INV-486 & INV-487: Ensures users can only access their own tenant search history
   */
  async getUserHistory(
    organizationId: string,
    userId: string,
    requestingUserId: string,
    limit?: number,
  ) {
    if (userId !== requestingUserId) {
      throw new ForbiddenException(
        "Cannot access another user's private search history (INV-487)",
      );
    }

    return this.historyRepo.listUserHistory({
      organizationId,
      userId,
      limit,
    });
  }

  async deleteHistoryItem(
    id: string,
    organizationId: string,
    userId: string,
    requestingUserId: string,
  ) {
    if (userId !== requestingUserId) {
      throw new ForbiddenException(
        "Cannot delete another user's search history (INV-487)",
      );
    }

    await this.historyRepo.deleteHistoryItem(id, organizationId, userId);
    return { success: true };
  }

  async clearHistory(
    organizationId: string,
    userId: string,
    requestingUserId: string,
  ) {
    if (userId !== requestingUserId) {
      throw new ForbiddenException(
        "Cannot clear another user's search history (INV-487)",
      );
    }

    await this.historyRepo.clearUserHistory(organizationId, userId);
    return { success: true };
  }
}
