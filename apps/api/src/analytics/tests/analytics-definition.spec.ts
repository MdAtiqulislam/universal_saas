import { AnalyticsDefinitionRegistry } from '../registry/analytics-definition.registry';

describe('AnalyticsDefinitionRegistry (INV-501, INV-502)', () => {
  it('INV-501: provides authoritative catalog of 12 real domain datasets', () => {
    const allDefs = AnalyticsDefinitionRegistry.getAll();
    expect(allDefs.length).toBe(12);

    const keys = allDefs.map((d) => d.definitionKey).sort();
    expect(keys).toEqual([
      'crm.customer',
      'finance.invoice',
      'inventory.stock',
      'inventory.turnover',
      'notifications.delivery',
      'quality.defects',
      'returns.rate',
      'sales.orders',
      'sales.revenue',
      'service.tickets',
      'warehouse.throughput',
      'workflow.execution',
    ]);
  });

  it('INV-501: ensures definitionKey is unique and registry lookup is idempotent', () => {
    const salesRev = AnalyticsDefinitionRegistry.get('sales.revenue');
    expect(salesRev).toBeDefined();
    expect(salesRev?.domain).toBe('sales');
    expect(salesRev?.defaultTimeDimension).toBe('createdAt');

    const nonExistent = AnalyticsDefinitionRegistry.get('unknown.dataset');
    expect(nonExistent).toBeUndefined();
    expect(AnalyticsDefinitionRegistry.has('unknown.dataset')).toBe(false);
  });

  it('INV-502: enforces explicit allowed dimensions and measures per definition', () => {
    const stock = AnalyticsDefinitionRegistry.get('inventory.stock');
    expect(stock).toBeDefined();
    expect(stock?.allowedDimensions).toContain('warehouseId');
    expect(stock?.allowedDimensions).toContain('sku');
    expect(stock?.allowedDimensions.length).toBeLessThanOrEqual(10);

    const measureNames = stock?.allowedMeasures.map((m) => m.name);
    expect(measureNames).toContain('quantityOnHand');
    expect(measureNames).toContain('stockValuation');
  });

  it('INV-502: verifies required permissions exist on all 12 definitions', () => {
    const allDefs = AnalyticsDefinitionRegistry.getAll();
    for (const def of allDefs) {
      expect(def.requiredPermissions).toBeDefined();
      expect(def.requiredPermissions.length).toBeGreaterThan(0);
      expect(def.requiredPermissions).toContain('analytics.query.execute');
    }
  });

  it('INV-507: verifies currency measures declare isCurrency flag and cents unit', () => {
    const salesRev = AnalyticsDefinitionRegistry.get('sales.revenue');
    const revenueMeasure = salesRev?.allowedMeasures.find(
      (m) => m.name === 'totalRevenue',
    );
    expect(revenueMeasure?.isCurrency).toBe(true);
    expect(revenueMeasure?.unit).toBe('cents');

    const invValuation = AnalyticsDefinitionRegistry.get(
      'inventory.stock',
    )?.allowedMeasures.find((m) => m.name === 'stockValuation');
    expect(invValuation?.isCurrency).toBe(true);
  });
});
