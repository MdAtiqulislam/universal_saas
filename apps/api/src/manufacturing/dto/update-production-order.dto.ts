import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';

export class UpdateProductionOrderDto {
  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  plannedQuantity?: number;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsDateString()
  @IsOptional()
  plannedStartDate?: string;

  @IsDateString()
  @IsOptional()
  plannedCompletionDate?: string;

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
