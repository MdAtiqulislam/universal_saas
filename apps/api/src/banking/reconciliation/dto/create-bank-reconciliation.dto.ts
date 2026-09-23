import { IsUUID, IsDateString } from 'class-validator';

export class CreateBankReconciliationDto {
  @IsUUID()
  statementId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
