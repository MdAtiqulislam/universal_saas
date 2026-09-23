import { Injectable } from '@nestjs/common';
import { SearchRecord } from '../providers/search-provider.interface';

@Injectable()
export class SearchRankingService {
  /**
   * Computes a deterministic relevance score for a record given a query term
   */
  computeRelevanceScore(record: SearchRecord, query?: string): number {
    if (!query || !query.trim()) {
      // Default score based on recency if no query string
      return this.computeRecencyBonus(record.createdAt);
    }

    const cleanQuery = query.trim().toLowerCase();
    const cleanId = record.id.toLowerCase();
    const cleanTitle = record.title.toLowerCase();
    const cleanSubtitle = record.subtitle?.toLowerCase() || '';
    const cleanDesc = record.description?.toLowerCase() || '';

    let score = 0;

    // 1. Exact ID match (1000 pts)
    if (cleanId === cleanQuery) {
      score += 1000;
    }

    // 2. Exact Title match (800 pts)
    if (cleanTitle === cleanQuery) {
      score += 800;
    } else if (cleanTitle.startsWith(cleanQuery)) {
      // 3. Prefix match (500 pts)
      score += 500;
    } else if (cleanTitle.includes(cleanQuery)) {
      // 4. Substring in title (300 pts)
      score += 300;
    }

    // 5. Token match across title & subtitle (200 pts per matching token, up to 400 pts)
    const tokens = cleanQuery.split(/\s+/).filter(Boolean);
    let tokenMatches = 0;
    for (const t of tokens) {
      if (cleanTitle.includes(t) || cleanSubtitle.includes(t)) {
        tokenMatches++;
      }
    }
    score += Math.min(400, tokenMatches * 150);

    // 6. Substring in description / subtitle (100 pts)
    if (cleanDesc.includes(cleanQuery) || cleanSubtitle.includes(cleanQuery)) {
      score += 100;
    }

    // 7. Deterministic recency boost (0 - 50 pts)
    score += this.computeRecencyBonus(record.createdAt);

    return score;
  }

  private computeRecencyBonus(createdAt: Date): number {
    const ageDays = Math.max(
      0,
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    // Linear degradation over 90 days from 50 to 0
    return Math.max(0, Math.round(50 * (1 - ageDays / 90)));
  }

  /**
   * INV-485: Sorts results deterministically using score DESC, date DESC, and stable id ASC
   */
  rankAndSort(records: SearchRecord[], query?: string): SearchRecord[] {
    const scored = records.map((r) => ({
      ...r,
      score: this.computeRelevanceScore(r, query),
    }));

    return scored.sort((a, b) => {
      // 1. Relevance score descending
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // 2. Created date descending
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      // 3. Deterministic tie-breaker: id ascending
      return a.id.localeCompare(b.id);
    });
  }
}
