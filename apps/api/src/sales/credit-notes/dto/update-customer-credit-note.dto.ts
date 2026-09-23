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
import { CreateCustomerCreditNoteLineDto } from './create-customer-credit-note.dto';

export class UpdateCustomerCreditNoteDto {
  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsDateString()
  @IsOptional()
  creditDate?: string;

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
  @Type(() => CreateCustomerCreditNoteLineDto)
  lines?: CreateCustomerCreditNoteLineDto[];
}
