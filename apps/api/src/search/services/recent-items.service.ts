import { Injectable, ForbiddenException } from '@nestjs/common';
import { RecentItemsRepository } from '../repositories/recent-items.repository';
import { CreateRecentItemDto } from '../dto/search-preference.dto';

@Injectable()
export class RecentItemsService {
  constructor(private readonly recentRepo: RecentItemsRepository) {}

  async recordRecentItem(
    organizationId: string,
    userId: string,
    dto: CreateRecentItemDto,
  ) {
    return this.recentRepo.recordRecentItem({
      organizationId,
      userId,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      scope: dto.scope,
      title: dto.title,
      subtitle: dto.subtitle,
      url: dto.url,
      metadata: dto.metadata,
    });
  }

  /**
   * INV-488: Returns recent items strictly scoped to caller's tenant and user
   */
  async getRecentItems(
    organizationId: string,
    userId: string,
    requestingUserId: string,
    limit?: number,
  ) {
    if (userId !== requestingUserId) {
      throw new ForbiddenException(
        "Cannot access another user's recent items (INV-488)",
      );
    }

    return this.recentRepo.listRecentItems({
      organizationId,
      userId,
      limit,
    });
  }

  async deleteRecentItem(
    id: string,
    organizationId: string,
    userId: string,
    requestingUserId: string,
  ) {
    if (userId !== requestingUserId) {
      throw new ForbiddenException(
        "Cannot delete another user's recent item (INV-488)",
      );
    }

    await this.recentRepo.deleteRecentItem(id, organizationId, userId);
    return { success: true };
  }

  async clearRecentItems(
    organizationId: string,
    userId: string,
    requestingUserId: string,
  ) {
    if (userId !== requestingUserId) {
      throw new ForbiddenException(
        "Cannot clear another user's recent items (INV-488)",
      );
    }

    await this.recentRepo.clearRecentItems(organizationId, userId);
    return { success: true };
  }
}
