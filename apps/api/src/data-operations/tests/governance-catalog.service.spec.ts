import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  GovernanceClassification,
  GovernanceDeletionStrategy,
} from '@prisma/client';
import { GovernanceCatalogService } from '../services/governance-catalog.service';
import {
  GOVERNANCE_DATASET_DEFINITIONS,
  NON_GOVERNED_DATASET_REASONS,
  UNRESOLVED_GOVERNANCE_CATEGORIES,
  UNRESOLVED_GOVERNANCE_MODELS,
} from '../registry/governance-dataset.registry';

describe('GovernanceCatalogService (M47.2)', () => {
  const prisma: any = {
    governanceDataset: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const audit: any = { record: jest.fn() };
  const service = new GovernanceCatalogService(prisma, audit);

  beforeEach(() => jest.clearAllMocks());

  it('validates the authoritative catalog and explicit non-governed exclusions', () => {
    expect(() => service.validateDefinitions()).not.toThrow();
    const completeness = service.validateCompleteness();
    expect(completeness.governed).toContain('crm.customer');
    expect(completeness.nonGoverned).toEqual(NON_GOVERNED_DATASET_REASONS);
    expect(completeness.unresolved).toEqual(Object.keys(UNRESOLVED_GOVERNANCE_MODELS));
    expect(completeness.unresolved).not.toContain('idempotencyRecord');
  });

  it('keeps governed, excluded, and unresolved model sets disjoint', () => {
    const governed = new Set(
      service.listDefinitions().flatMap((definition) =>
        definition.modelName ? [definition.modelName] : [],
      ),
    );
    const excluded = new Set(Object.keys(NON_GOVERNED_DATASET_REASONS));
    const unresolved = new Set(Object.keys(UNRESOLVED_GOVERNANCE_MODELS));

    for (const model of governed) {
      expect(excluded.has(model)).toBe(false);
      expect(unresolved.has(model)).toBe(false);
    }
    for (const model of excluded) expect(unresolved.has(model)).toBe(false);
    expect(UNRESOLVED_GOVERNANCE_CATEGORIES.M47_INTERNAL_GOVERNANCE_INFRASTRUCTURE).toEqual(
      expect.arrayContaining(['governanceDataset', 'dsarRequest']),
    );
  });

  it('never resolves unresolved or excluded models as governed datasets', async () => {
    expect(() => service.getDefinition('governanceDataset')).toThrow(NotFoundException);
    expect(() => service.getDefinition('backgroundJob')).toThrow(NotFoundException);
    expect(() => service.getDefinition('account')).toThrow(NotFoundException);
  });

  it('contains explicit classification and deletion strategy for every definition', () => {
    for (const definition of GOVERNANCE_DATASET_DEFINITIONS) {
      expect(Object.values(GovernanceClassification)).toContain(definition.classification);
      expect(Object.values(GovernanceDeletionStrategy)).toContain(definition.deletionStrategy);
    }
  });

  it('requires financial facts to use immutable financial retention', () => {
    const financialDefinitions = GOVERNANCE_DATASET_DEFINITIONS.filter(
      (definition) => definition.metadata?.financialFacts === true,
    );
    expect(financialDefinitions.length).toBeGreaterThan(0);
    expect(
      financialDefinitions.every(
        (definition) =>
          definition.deletionStrategy === GovernanceDeletionStrategy.IMMUTABLE_FINANCIAL_RETAIN,
      ),
    ).toBe(true);
  });

  it('resolves only active persisted catalog entries registered by dataset key', async () => {
    prisma.governanceDataset.findUnique.mockResolvedValue({
      datasetKey: 'crm.customer',
      isActive: true,
    });
    await expect(service.get('crm.customer')).resolves.toEqual({
      datasetKey: 'crm.customer',
      isActive: true,
    });
    await expect(service.get('not-registered')).rejects.toThrow(NotFoundException);
  });

  it('bootstrap is deterministic and uses dataset-key upsert identity', async () => {
    prisma.governanceDataset.upsert.mockImplementation(async ({ create }: { create: any }) => ({
      ...create,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }));
    const result = await service.bootstrap();
    expect(result.created).toBe(GOVERNANCE_DATASET_DEFINITIONS.length);
    expect(prisma.governanceDataset.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { datasetKey: 'crm.customer' },
      }),
    );
  });

  it('rejects duplicate authoritative keys when the definition list is corrupted', () => {
    const original = (service as any).definitions;
    (service as any).definitions = [original[0], original[0]];
    expect(() => service.validateDefinitions()).toThrow(ConflictException);
    (service as any).definitions = original;
  });
});
