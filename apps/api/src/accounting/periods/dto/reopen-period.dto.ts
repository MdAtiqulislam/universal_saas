import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ReopenPeriodDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5, {
    message:
      'Reopen reason must be at least 5 characters long for audit justification',
  })
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason!: string;
}
