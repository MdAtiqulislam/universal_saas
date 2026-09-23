import { SearchRankingService } from '../services/search-ranking.service';
import { SearchRecord } from '../providers/search-provider.interface';
import { SearchScope } from '@prisma/client';

describe('SearchRankingService', () => {
  let service: SearchRankingService;

  beforeEach(() => {
    service = new SearchRankingService();
  });

  const baseRecord: SearchRecord = {
    id: 'CUST-001',
    scope: SearchScope.CRM,
    resourceType: 'Customer',
    title: 'Acme Corporation',
    subtitle: 'Enterprise Client',
    description: 'Global wholesale supplier of widgets and gadgets',
    url: '/crm/customers/CUST-001',
    score: 0,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
  };

  describe('computeRelevanceScore', () => {
    it('awards 1000 points for exact ID match', () => {
      const score = service.computeRelevanceScore(baseRecord, 'CUST-001');
      expect(score).toBeGreaterThanOrEqual(1000);
    });

    it('awards 800 points for exact title match', () => {
      const score = service.computeRelevanceScore(
        baseRecord,
        'Acme Corporation',
      );
      expect(score).toBeGreaterThanOrEqual(800);
    });

    it('awards 500 points for prefix match on title', () => {
      const score = service.computeRelevanceScore(baseRecord, 'Acme');
      expect(score).toBeGreaterThanOrEqual(500);
    });

    it('awards points for subtitle and description matches', () => {
      const subtitleScore = service.computeRelevanceScore(
        baseRecord,
        'Enterprise',
      );
      const descScore = service.computeRelevanceScore(baseRecord, 'widgets');
      expect(subtitleScore).toBeGreaterThan(0);
      expect(descScore).toBeGreaterThan(0);
    });
  });

  describe('rankAndSort (INV-485)', () => {
    it('sorts deterministically by score DESC, then date DESC, then id ASC', () => {
      const records: SearchRecord[] = [
        {
          ...baseRecord,
          id: 'REC-3',
          title: 'Widgets Beta',
        },
        {
          ...baseRecord,
          id: 'REC-1',
          title: 'Acme Corporation', // Exact title match -> 800+
        },
        {
          ...baseRecord,
          id: 'REC-2',
          title: 'Acme Global', // Prefix match -> 500+
        },
      ];

      const ranked = service.rankAndSort(records, 'Acme Corporation');
      expect(ranked[0].id).toBe('REC-1');
      expect(ranked[1].id).toBe('REC-2');
      expect(ranked[2].id).toBe('REC-3');
    });

    it('breaks ties deterministically using id ASC', () => {
      const date = new Date('2026-09-01T00:00:00Z');
      const records: SearchRecord[] = [
        { ...baseRecord, id: 'REC-Z', title: 'Tie Match', createdAt: date },
        { ...baseRecord, id: 'REC-A', title: 'Tie Match', createdAt: date },
        { ...baseRecord, id: 'REC-M', title: 'Tie Match', createdAt: date },
      ];

      const ranked = service.rankAndSort(records, 'Tie Match');
      expect(ranked.map((r) => r.id)).toEqual(['REC-A', 'REC-M', 'REC-Z']);
    });
  });
});
