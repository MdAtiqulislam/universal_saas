import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CreateQuotationLineDto } from './create-quotation.dto';

export class UpdateQuotationDto {
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsDateString()
  @IsOptional()
  quotationDate?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  shippingTotal?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateQuotationLineDto)
  lines?: CreateQuotationLineDto[];
}
