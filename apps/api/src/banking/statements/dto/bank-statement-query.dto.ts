import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BankStatementStatus } from '@prisma/client';

export class BankStatementQueryDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  @IsEnum(BankStatementStatus)
  @IsOptional()
  status?: BankStatementStatus;

  @IsUUID()
  @IsOptional()
  paymentAccountId?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}
