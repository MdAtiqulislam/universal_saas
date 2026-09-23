import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class ProcessServiceHandoverDto {
  @IsOptional()
  @IsDateString()
  handoverDate?: string;

  @IsNotEmpty()
  @IsString()
  recipientName!: string;

  @IsOptional()
  @IsString()
  recipientContact?: string;

  @IsOptional()
  @IsString()
  acceptanceNotes?: string;

  @IsOptional()
  @IsString()
  deliveryReference?: string;
}
