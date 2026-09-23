import {
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AccountType } from '@prisma/client';

export class TrialBalanceQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  @IsOptional()
  fiscalPeriodId?: string;

  @IsEnum(AccountType)
  @IsOptional()
  accountType?: AccountType;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  includeZeroBalance?: boolean = false;
}
