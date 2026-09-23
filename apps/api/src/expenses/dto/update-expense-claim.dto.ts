import {
  IsUUID,
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateExpenseClaimLineDto } from './create-expense-claim.dto';

export class UpdateExpenseClaimDto {
  @IsUUID()
  @IsOptional()
  claimantId?: string;

  @IsDateString()
  @IsOptional()
  claimDate?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateExpenseClaimLineDto)
  lines?: CreateExpenseClaimLineDto[];
}
