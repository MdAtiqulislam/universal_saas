import { IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class RejectExpenseClaimDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason!: string;
}
