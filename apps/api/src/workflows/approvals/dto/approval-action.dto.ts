import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { WorkflowApprovalStatus } from '@prisma/client';

export class ApprovalDecisionDto {
  @IsNotEmpty()
  @IsEnum(WorkflowApprovalStatus)
  decision!: WorkflowApprovalStatus; // APPROVED or REJECTED

  @ValidateIf((o: ApprovalDecisionDto) => o.decision === 'REJECTED')
  @IsNotEmpty({
    message: 'Reason is mandatory when rejecting an approval request',
  })
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  delegatedFromUserId?: string;
}

export class DelegateApprovalDto {
  @IsNotEmpty()
  @IsUUID()
  delegateUserId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class QueryApprovalsDto {
  @IsOptional()
  @IsEnum(WorkflowApprovalStatus)
  status?: WorkflowApprovalStatus;
}
