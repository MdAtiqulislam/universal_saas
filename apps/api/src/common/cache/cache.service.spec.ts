import { CacheService } from './cache.service';

describe('CacheService (Milestone M36)', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
  });

  it('should isolate cached keys strictly across tenant organizations', () => {
    const orgA = 'org-tenant-a';
    const orgB = 'org-tenant-b';

    const keyA = cache.tenantKey(orgA, 'config', 'tax_rate');
    const keyB = cache.tenantKey(orgB, 'config', 'tax_rate');

    cache.set(keyA, { rate: 10 });
    cache.set(keyB, { rate: 20 });

    expect(cache.get(keyA)).toEqual({ rate: 10 });
    expect(cache.get(keyB)).toEqual({ rate: 20 });
    expect(keyA).not.toBe(keyB);
  });

  it('should support getOrSet with async fallback', async () => {
    const key = cache.globalKey('permissions', 'all');
    let dbCallCount = 0;

    const fetcher = async () => {
      dbCallCount++;
      return ['crm.leads.view', 'sales.orders.view'];
    };

    const val1 = await cache.getOrSet(key, fetcher, 60);
    const val2 = await cache.getOrSet(key, fetcher, 60);

    expect(val1).toEqual(val2);
    expect(dbCallCount).toBe(1); // Cached after first call
  });

  it('should invalidate specific namespace for a tenant without affecting other tenants', () => {
    const orgA = 'org-tenant-a';
    const orgB = 'org-tenant-b';

    const keyA1 = cache.tenantKey(orgA, 'warranties', 'policy_1');
    const keyA2 = cache.tenantKey(orgA, 'warranties', 'policy_2');
    const keyB1 = cache.tenantKey(orgB, 'warranties', 'policy_1');

    cache.set(keyA1, 'valA1');
    cache.set(keyA2, 'valA2');
    cache.set(keyB1, 'valB1');

    cache.invalidateNamespace(orgA, 'warranties');

    expect(cache.get(keyA1)).toBeNull();
    expect(cache.get(keyA2)).toBeNull();
    expect(cache.get(keyB1)).toBe('valB1'); // Org B remains intact
  });
});
