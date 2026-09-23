import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsString,
  IsOptional,
} from 'class-validator';

export class TransferFixedAssetDto {
  @IsUUID()
  @IsNotEmpty()
  toLocationId!: string;

  @IsDateString()
  @IsNotEmpty()
  transferDate!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
