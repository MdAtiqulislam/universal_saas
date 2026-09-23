import {
  IsInt,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class UpdateReturnPolicyDto {
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  returnWindowDays?: number;

  @IsBoolean()
  @IsOptional()
  requireOriginalShipment?: boolean;

  @IsBoolean()
  @IsOptional()
  requireOriginalInvoice?: boolean;

  @IsBoolean()
  @IsOptional()
  allowPartialReturns?: boolean;

  @IsBoolean()
  @IsOptional()
  requireInspection?: boolean;

  @IsBoolean()
  @IsOptional()
  autoQuarantine?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxReplacementQty?: number;

  @IsBoolean()
  @IsOptional()
  allowRestocking?: boolean;

  @IsBoolean()
  @IsOptional()
  autoCreateCreditNote?: boolean;
}
