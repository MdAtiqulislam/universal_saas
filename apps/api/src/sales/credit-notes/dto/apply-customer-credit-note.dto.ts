import {
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreditApplicationItemDto {
  @IsUUID()
  customerInvoiceId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  amount!: number;
}

export class ApplyCustomerCreditNoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreditApplicationItemDto)
  applications!: CreditApplicationItemDto[];
}
