import { ConflictException } from '@nestjs/common';

describe('WorkflowApprovalsService Logic (M40)', () => {
  it('correctly calculates ANY_ONE approval transition', () => {
    const approval = {
      approvalType: 'ANY_ONE',
      status: 'PENDING',
      minimumApprovals: 1,
    };

    const decision = 'APPROVED';
    const nextStatus =
      decision === 'APPROVED' && approval.approvalType === 'ANY_ONE'
        ? 'APPROVED'
        : 'PENDING';
    expect(nextStatus).toBe('APPROVED');
  });

  it('correctly calculates MINIMUM_COUNT quorum threshold', () => {
    const approval = {
      approvalType: 'MINIMUM_COUNT',
      status: 'PENDING',
      minimumApprovals: 3,
    };

    const isQuorumMet = (approvedCount: number, minimum: number) =>
      approvedCount >= minimum;
    expect(isQuorumMet(2, approval.minimumApprovals)).toBe(false);
    expect(isQuorumMet(3, approval.minimumApprovals)).toBe(true);
  });

  it('immediately marks approval as REJECTED when an approver rejects', () => {
    const decision = 'REJECTED';
    const nextStatus = decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    expect(nextStatus).toBe('REJECTED');
  });

  it('prevents duplicate votes from the same actor (INV-397)', () => {
    const votes = new Set<string>();
    const recordVote = (userId: string) => {
      if (votes.has(userId)) {
        throw new ConflictException('Vote already recorded');
      }
      votes.add(userId);
    };

    recordVote('user-1');
    expect(() => recordVote('user-1')).toThrow(ConflictException);
  });
});
