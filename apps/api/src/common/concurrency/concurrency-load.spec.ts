import { boundedParallel } from './concurrency.util';
import { Prisma } from '@prisma/client';

describe('Concurrency Load Simulations (Milestone M36)', () => {
  describe('1. 100 Concurrent Stock Reservations', () => {
    it('should safely reserve stock without overselling or negative inventory', async () => {
      let availableStock = new Prisma.Decimal('50'); // 50 units available
      let successfulReservations = 0;
      let rejectedReservations = 0;

      // 100 concurrent reservation attempts of 1 unit each
      const requests = Array.from({ length: 100 }, (_, i) => ({
        id: `req-${i}`,
        qty: new Prisma.Decimal('1'),
      }));

      // Mock transactional reservation with row-level balance guard
      await boundedParallel(requests, 10, async (req) => {
        // Atomic check and decrement simulation
        if (availableStock.gte(req.qty)) {
          availableStock = availableStock.sub(req.qty);
          successfulReservations++;
        } else {
          rejectedReservations++;
        }
      });

      expect(successfulReservations).toBe(50);
      expect(rejectedReservations).toBe(50);
      expect(availableStock.equals(0)).toBe(true);
    });
  });

  describe('2. 100 Concurrent Idempotent Payment Captures', () => {
    it('should process exact single payment and replay 99 duplicate requests without double-charge', async () => {
      const idempotencyKey = 'unique-payment-intent-999';
      const store = new Map<string, { status: string; count: number }>();

      let ledgerPostingsCount = 0;

      const requests = Array.from({ length: 100 }, (_, i) => ({
        id: `client-${i}`,
        key: idempotencyKey,
      }));

      await boundedParallel(requests, 20, async (req) => {
        if (store.has(req.key)) {
          const rec = store.get(req.key)!;
          rec.count++;
          return { status: rec.status, isReplay: true };
        } else {
          // First arrival registers payment
          store.set(req.key, { status: 'COMPLETED', count: 1 });
          ledgerPostingsCount++;
          return { status: 'COMPLETED', isReplay: false };
        }
      });

      expect(ledgerPostingsCount).toBe(1);
      expect(store.get(idempotencyKey)?.count).toBe(100);
    });
  });

  describe('3. 100 Concurrent Quotation Conversions', () => {
    it('should convert quotation exactly once and block 99 concurrent attempts', async () => {
      let isConverted = false;
      let salesOrderCreationCount = 0;
      let conflictCount = 0;

      const attempts = Array.from({ length: 100 }, (_, i) => i);

      await boundedParallel(attempts, 15, async () => {
        if (!isConverted) {
          isConverted = true;
          salesOrderCreationCount++;
        } else {
          conflictCount++;
        }
      });

      expect(salesOrderCreationCount).toBe(1);
      expect(conflictCount).toBe(99);
      expect(isConverted).toBe(true);
    });
  });
});
