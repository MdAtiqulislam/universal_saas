import { Injectable } from '@nestjs/common';
import { SearchAnalyticsRepository } from '../repositories/search-analytics.repository';

@Injectable()
export class SearchReportsService {
  constructor(private readonly analyticsRepo: SearchAnalyticsRepository) {}

  // 1. Search Usage Overview
  async getUsageOverview(organizationId: string, days = 30) {
    return this.analyticsRepo.getSearchUsageOverview(organizationId, days);
  }

  // 2. Search Volume by Module
  async getVolumeByModule(organizationId: string, days = 30) {
    return this.analyticsRepo.getVolumeByModule(organizationId, days);
  }

  // 3. Zero-Result Searches
  async getZeroResultSearches(organizationId: string, days = 30) {
    return this.analyticsRepo.getZeroResultSearches(organizationId, days);
  }

  // 4. Search Performance
  async getSearchPerformance(organizationId: string, days = 30) {
    return this.analyticsRepo.getSearchPerformance(organizationId, days);
  }

  // 5. Popular Search Terms
  async getPopularSearchTerms(organizationId: string, days = 30) {
    return this.analyticsRepo.getPopularSearchTerms(organizationId, days);
  }

  // 6. Saved Views Usage
  async getSavedViewsUsage(organizationId: string) {
    return this.analyticsRepo.getSavedViewsUsage(organizationId);
  }

  // 7. Search Alert Activity
  async getSearchAlertActivity(organizationId: string, days = 30) {
    return this.analyticsRepo.getSearchAlertActivity(organizationId, days);
  }

  // 8. Search API Usage
  async getSearchApiUsage(organizationId: string, days = 30) {
    return this.analyticsRepo.getSearchApiUsage(organizationId, days);
  }
}
