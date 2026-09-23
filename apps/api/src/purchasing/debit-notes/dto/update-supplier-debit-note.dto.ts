import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSupplierDebitNoteLineDto } from './create-supplier-debit-note.dto';

export class UpdateSupplierDebitNoteDto {
  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsDateString()
  @IsOptional()
  debitDate?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  @Type(() => CreateSupplierDebitNoteLineDto)
  lines?: CreateSupplierDebitNoteLineDto[];
}
