import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateProductionOrderDto {
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  @IsNotEmpty()
  bomId!: string;

  @IsNumber()
  @Min(0.0001)
  plannedQuantity!: number;

  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @IsDateString()
  @IsNotEmpty()
  plannedStartDate!: string;

  @IsDateString()
  @IsNotEmpty()
  plannedCompletionDate!: string;

  @IsString()
  @IsOptional()
  sourceDocument?: string;

  @IsUUID()
  @IsOptional()
  sourceDocumentId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
