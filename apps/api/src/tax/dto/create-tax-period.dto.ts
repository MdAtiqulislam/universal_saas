import { IsString, IsNotEmpty, MaxLength, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTaxPeriodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string; // e.g. "2026-07", "2026-Q3"

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
