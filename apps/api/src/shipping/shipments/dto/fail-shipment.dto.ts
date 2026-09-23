import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class FailShipmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  failureReason!: string;

  @IsString()
  @IsOptional()
  location?: string;
}
