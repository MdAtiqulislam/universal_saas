import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseReceiptDto {
  @IsUUID()
  @IsOptional()
  expenseClaimLineId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  fileSize?: number;
}
