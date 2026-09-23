import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CreateJournalLineDto } from './create-journal.dto';

export class UpdateJournalEntryDto {
  @IsUUID()
  @IsOptional()
  fiscalPeriodId?: string;

  @IsDateString()
  @IsOptional()
  entryDate?: string;

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
  @IsOptional()
  @Type(() => CreateJournalLineDto)
  lines?: CreateJournalLineDto[];
}
