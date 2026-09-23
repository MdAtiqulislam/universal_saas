import { IsUUID, IsOptional } from 'class-validator';

export class MatchTransactionDto {
  @IsUUID()
  @IsOptional()
  paymentId?: string;

  @IsUUID()
  @IsOptional()
  journalEntryId?: string;
}
