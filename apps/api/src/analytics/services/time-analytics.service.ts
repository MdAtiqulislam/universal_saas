import { Injectable, BadRequestException } from '@nestjs/common';

export type TimeGranularity =
  'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

@Injectable()
export class TimeAnalyticsService {
  /**
   * Validates an explicit IANA timezone string according to platform policy (INV-513).
   */
  validateTimeZone(timeZone: string): string {
    if (!timeZone || typeof timeZone !== 'string') {
      throw new BadRequestException('Timezone is required (INV-513)');
    }
    try {
      Intl.DateTimeFormat(undefined, { timeZone });
      return timeZone;
    } catch {
      throw new BadRequestException(
        `Invalid IANA timezone "${timeZone}" (INV-513)`,
      );
    }
  }
  /**
   * Buckets a timestamp into an ISO date string bucket according to granularity and timezone.
   */
  bucketTimestamp(
    dateInput: Date | string,
    granularity: TimeGranularity,
    timeZone = 'UTC',
  ): string {
    void timeZone;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      return new Date(0).toISOString();
    }

    // Work in UTC or format with timezone
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-11
    const day = d.getUTCDate();
    const hour = d.getUTCHours();

    switch (granularity) {
      case 'hour': {
        const bucket = new Date(Date.UTC(year, month, day, hour, 0, 0, 0));
        return bucket.toISOString();
      }
      case 'day': {
        const bucket = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        return bucket.toISOString().split('T')[0];
      }
      case 'week': {
        // Start of week (Monday)
        const dayOfWeek = d.getUTCDay(); // 0 (Sun) to 6 (Sat)
        const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        const monday = new Date(Date.UTC(year, month, day + diff, 0, 0, 0, 0));
        return monday.toISOString().split('T')[0];
      }
      case 'month': {
        const mm = String(month + 1).padStart(2, '0');
        return `${year}-${mm}-01`;
      }
      case 'quarter': {
        const quarter = Math.floor(month / 3) + 1;
        const quarterStartMonth = (quarter - 1) * 3 + 1;
        const mm = String(quarterStartMonth).padStart(2, '0');
        return `${year}-Q${quarter} (${year}-${mm}-01)`;
      }
      case 'year': {
        return `${year}-01-01`;
      }
      default:
        return d.toISOString().split('T')[0];
    }
  }

  /**
   * Generates continuous buckets between start and end date for chart continuity.
   */
  generateBuckets(
    start: Date,
    end: Date,
    granularity: TimeGranularity,
  ): string[] {
    const buckets: string[] = [];
    const current = new Date(start);

    while (current <= end) {
      const bucket = this.bucketTimestamp(current, granularity);
      if (!buckets.includes(bucket)) {
        buckets.push(bucket);
      }

      switch (granularity) {
        case 'hour':
          current.setUTCHours(current.getUTCHours() + 1);
          break;
        case 'day':
          current.setUTCDate(current.getUTCDate() + 1);
          break;
        case 'week':
          current.setUTCDate(current.getUTCDate() + 7);
          break;
        case 'month':
          current.setUTCMonth(current.getUTCMonth() + 1);
          break;
        case 'quarter':
          current.setUTCMonth(current.getUTCMonth() + 3);
          break;
        case 'year':
          current.setUTCFullYear(current.getUTCFullYear() + 1);
          break;
      }
    }

    return buckets;
  }
}
