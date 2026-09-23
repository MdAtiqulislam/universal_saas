import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateJournalLineDto {
  @IsUUID()
  accountId!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  debit?: number = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  credit?: number = 0;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  lineNumber?: number;
}

export class CreateJournalEntryDto {
  @IsUUID()
  fiscalPeriodId!: string;

  @IsDateString()
  entryDate!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  sourceType?: string;

  @IsUUID()
  @IsOptional()
  sourceId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
