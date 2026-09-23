import {
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DebitApplicationItemDto {
  @IsUUID()
  supplierInvoiceId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Type(() => Number)
  amount!: number;
}

export class ApplySupplierDebitNoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => DebitApplicationItemDto)
  applications!: DebitApplicationItemDto[];
}
