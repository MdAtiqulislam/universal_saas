import {
  chunkedExecution,
  boundedParallel,
  retryWithBackoff,
} from './concurrency.util';

describe('Concurrency Utilities (Milestone M36)', () => {
  describe('chunkedExecution', () => {
    it('should split 10 items into chunks of 3 and process sequentially', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunkSizes: number[] = [];

      const results = await chunkedExecution(items, 3, async (chunk) => {
        chunkSizes.push(chunk.length);
        return chunk.map((n) => n * 2);
      });

      expect(chunkSizes).toEqual([3, 3, 3, 1]);
      expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    });
  });

  describe('boundedParallel', () => {
    it('should execute tasks with max concurrency without exceeding boundary', async () => {
      const items = Array.from({ length: 20 }, (_, i) => i + 1);
      let activeConcurrency = 0;
      let maxObservedConcurrency = 0;

      const results = await boundedParallel(items, 4, async (item) => {
        activeConcurrency++;
        maxObservedConcurrency = Math.max(
          maxObservedConcurrency,
          activeConcurrency,
        );
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeConcurrency--;
        return item * 10;
      });

      expect(maxObservedConcurrency).toBeLessThanOrEqual(4);
      expect(results).toHaveLength(20);
      expect(results[0]).toBe(10);
      expect(results[19]).toBe(200);
    });
  });

  describe('retryWithBackoff', () => {
    it('should retry transient errors and succeed once resolved', async () => {
      let attempts = 0;
      const result = await retryWithBackoff(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient network error');
          }
          return 'SUCCESS';
        },
        3,
        5,
      );

      expect(attempts).toBe(3);
      expect(result).toBe('SUCCESS');
    });

    it('should rethrow after max retries exceeded', async () => {
      await expect(
        retryWithBackoff(
          async () => {
            throw new Error('Fatal error');
          },
          2,
          5,
        ),
      ).rejects.toThrow('Fatal error');
    });
  });
});
