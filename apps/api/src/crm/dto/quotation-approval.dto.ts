import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SubmitQuotationDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveQuotationDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectQuotationDto {
  @IsNotEmpty()
  @IsString()
  rejectionReason!: string;
}

export class AcceptQuotationDto {
  @IsNotEmpty()
  @IsString()
  acceptedBy!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VoidQuotationDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
