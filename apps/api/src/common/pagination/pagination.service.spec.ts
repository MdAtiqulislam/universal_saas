import { PaginationService } from './pagination.service';
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from './pagination.dto';

describe('PaginationService (Milestone M36)', () => {
  let service: PaginationService;

  beforeEach(() => {
    service = new PaginationService();
  });

  describe('Cursor Encoding & Decoding', () => {
    it('should encode and decode cursor payload safely', () => {
      const payload = {
        id: '11111111-1111-1111-1111-111111111111',
        createdAt: '2026-08-30T12:00:00.000Z',
      };

      const encoded = service.encodeCursor(payload);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(10);

      const decoded = service.decodeCursor(encoded);
      expect(decoded).toEqual(payload);
    });

    it('should throw BadRequestException for malformed cursor string', () => {
      expect(() => service.decodeCursor('invalid-cursor-string-123')).toThrow();
    });
  });

  describe('Page Size Clamping & Boundaries', () => {
    it('should clamp limit to MAX_PAGE_SIZE when requested exceeds bound', () => {
      expect(service.clampLimit(500)).toBe(MAX_PAGE_SIZE);
      expect(service.clampLimit(100)).toBe(100);
      expect(service.clampLimit(25)).toBe(25);
    });

    it('should use DEFAULT_PAGE_SIZE when requested limit is 0 or negative', () => {
      expect(service.clampLimit(0)).toBe(DEFAULT_PAGE_SIZE);
      expect(service.clampLimit(-5)).toBe(DEFAULT_PAGE_SIZE);
      expect(service.clampLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    });
  });

  describe('Result Construction', () => {
    it('should construct deterministic offset paginated result metadata', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const result = service.buildPaginatedResult(items, 50, 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(50);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPrevPage).toBe(false);
    });

    it('should construct deterministic cursor paginated result with nextCursor', () => {
      const items = [
        { id: '1', createdAt: new Date('2026-08-30T10:00:00Z') },
        { id: '2', createdAt: new Date('2026-08-30T09:00:00Z') },
        { id: '3', createdAt: new Date('2026-08-30T08:00:00Z') },
      ];

      // Limit = 2, total items = 3 (hasNextPage = true)
      const result = service.buildCursorResult(items, 2);

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).not.toBeNull();

      const decoded = service.decodeCursor(result.meta.nextCursor!);
      expect(decoded.id).toBe('2');
    });
  });
});
