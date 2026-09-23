import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsUUID,
  IsString,
} from 'class-validator';

export class DisposeFixedAssetDto {
  @IsDateString()
  @IsNotEmpty()
  disposalDate!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  disposalProceeds?: number;

  @IsUUID()
  @IsOptional()
  proceedsPaymentAccountId?: string;

  @IsString()
  @IsOptional()
  disposalReason?: string;
}
