import { Injectable, ForbiddenException } from '@nestjs/common';
import { FavoritesRepository } from '../repositories/favorites.repository';
import { CreateFavoriteItemDto } from '../dto/search-preference.dto';
import { SearchScope } from '@prisma/client';

@Injectable()
export class FavoritesService {
  constructor(private readonly favoritesRepo: FavoritesRepository) {}

  /**
   * INV-489: Adds favorite uniquely per user, tenant, and resource identity
   */
  async addFavorite(
    organizationId: string,
    userId: string,
    dto: CreateFavoriteItemDto,
  ) {
    return this.favoritesRepo.addFavorite({
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
   * Lists user favorites within tenant
   */
  async getFavorites(params: {
    organizationId: string;
    userId: string;
    requestingUserId: string;
    resourceType?: string;
    scope?: SearchScope;
    limit?: number;
  }) {
    if (params.userId !== params.requestingUserId) {
      throw new ForbiddenException(
        "Cannot access another user's favorites (INV-489)",
      );
    }

    return this.favoritesRepo.listFavorites({
      organizationId: params.organizationId,
      userId: params.userId,
      resourceType: params.resourceType,
      scope: params.scope,
      limit: params.limit,
    });
  }

  async removeFavorite(
    organizationId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    requestingUserId: string,
  ) {
    if (userId !== requestingUserId) {
      throw new ForbiddenException(
        "Cannot remove another user's favorite (INV-489)",
      );
    }

    await this.favoritesRepo.removeFavorite({
      organizationId,
      userId,
      resourceType,
      resourceId,
    });
    return { success: true };
  }

  async removeFavoriteById(
    id: string,
    organizationId: string,
    userId: string,
    requestingUserId: string,
  ) {
    if (userId !== requestingUserId) {
      throw new ForbiddenException(
        "Cannot remove another user's favorite (INV-489)",
      );
    }

    await this.favoritesRepo.removeFavoriteById(id, organizationId, userId);
    return { success: true };
  }
}
