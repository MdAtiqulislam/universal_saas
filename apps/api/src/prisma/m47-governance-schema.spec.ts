import {
  DsarBatchStatus,
  DsarRequestStatus,
  DsarRequestType,
  GovernanceClassification,
  GovernanceDeletionStrategy,
  GovernanceResidencyTier,
  GovernanceTransferPolicy,
  LegalHoldStatus,
  LegalHoldTargetType,
  Prisma,
  RetentionAnchor,
} from '@prisma/client';

describe('M47.1 Governance Foundation schema', () => {
  it('defines logical governance catalog and policy values', () => {
    expect(Object.values(GovernanceClassification)).toEqual([
      'PUBLIC',
      'INTERNAL',
      'CONFIDENTIAL',
      'RESTRICTED',
    ]);
    expect(Object.values(GovernanceDeletionStrategy)).toEqual([
      'HARD_DELETE',
      'ANONYMIZE_PII',
      'IMMUTABLE_FINANCIAL_RETAIN',
    ]);
    expect(Object.values(GovernanceResidencyTier)).toEqual([
      'STANDARD',
      'SENSITIVE',
      'RESTRICTED',
    ]);
    expect(Object.values(GovernanceTransferPolicy)).toEqual([
      'ALLOWED',
      'RESTRICTED',
      'PROHIBITED',
    ]);
    expect(Object.values(RetentionAnchor)).toEqual([
      'RECORD_CREATED_AT',
      'RECORD_UPDATED_AT',
      'DOMAIN_EVENT_AT',
      'EXPIRES_AT',
    ]);
  });

  it('defines tenant-scoped residency and dataset-aware retention inputs', () => {
    const residency: Prisma.DataResidencyPolicyUncheckedCreateInput = {
      organizationId: 'org-1',
      datasetId: 'dataset-1',
      jurisdictionCode: 'example-jurisdiction',
      residencyTier: GovernanceResidencyTier.STANDARD,
      transferPolicy: GovernanceTransferPolicy.RESTRICTED,
      transferConfiguration: { allowlistedJurisdictions: [] },
    };
    const dataset: Prisma.GovernanceDatasetUncheckedCreateInput = {
      datasetKey: 'crm.customer',
      displayName: 'CRM Customer',
      classification: GovernanceClassification.CONFIDENTIAL,
      deletionStrategy: GovernanceDeletionStrategy.ANONYMIZE_PII,
      containsPii: true,
    };
    const retention: Prisma.DataRetentionPolicyUncheckedCreateInput = {
      organizationId: 'org-1',
      datasetId: 'dataset-1',
      retentionDurationDays: 365,
      anchor: RetentionAnchor.DOMAIN_EVENT_AT,
      version: 1,
      effectiveMarker: null,
    };
    const currentRetention: Prisma.DataRetentionPolicyUncheckedCreateInput = {
      ...retention,
      version: 2,
      effectiveMarker: 'CURRENT',
    };

    expect(residency.organizationId).toBe('org-1');
    expect(dataset.datasetKey).toBe('crm.customer');
    expect(retention.datasetId).toBe('dataset-1');
    expect(retention.anchor).toBe(RetentionAnchor.DOMAIN_EVENT_AT);
    expect(retention.effectiveMarker).toBeNull();
    expect(currentRetention.effectiveMarker).toBe('CURRENT');
    expect(Prisma.DataRetentionPolicyScalarFieldEnum.effectiveMarker).toBe(
      'effectiveMarker',
    );
  });

  it('defines explicit legal-hold coverage and lifecycle metadata', () => {
    const hold: Prisma.LegalHoldUncheckedCreateInput = {
      organizationId: 'org-1',
      targetType: LegalHoldTargetType.DATASET,
      targetId: 'dataset-1',
      coverage: { relationPaths: ['customer.invoices'] },
      status: LegalHoldStatus.ACTIVE,
      reason: 'Review reference',
      createdByUserId: 'user-1',
    };

    expect(hold.organizationId).toBe('org-1');
    expect(hold.status).toBe(LegalHoldStatus.ACTIVE);
    expect(hold.coverage).toEqual({ relationPaths: ['customer.invoices'] });
  });

  it('defines DSAR types, resumable lifecycle states, and operation identity', () => {
    const request: Prisma.DsarRequestUncheckedCreateInput = {
      organizationId: 'org-1',
      requestType: DsarRequestType.ERASURE,
      status: DsarRequestStatus.SUBMITTED,
      requesterUserId: 'user-1',
      subjectUserId: 'user-2',
      idempotencyKey: 'dsar:org-1:request-1',
    };
    const batch: Prisma.DsarExecutionBatchUncheckedCreateInput = {
      organizationId: 'org-1',
      dsarRequestId: 'request-1',
      datasetId: 'dataset-1',
      batchSequence: 0,
      status: DsarBatchStatus.PENDING,
    };

    expect(Object.values(DsarRequestType)).toEqual(['ACCESS', 'EXPORT', 'ERASURE']);
    expect(Object.values(DsarRequestStatus)).toContain('BLOCKED_BY_HOLD');
    expect(Object.values(DsarBatchStatus)).toContain('PROCESSING');
    expect(request.organizationId).toBe(batch.organizationId);
    expect(request.idempotencyKey).toContain('dsar:');
  });
});
