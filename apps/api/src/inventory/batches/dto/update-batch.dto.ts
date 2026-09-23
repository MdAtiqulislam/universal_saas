import { IsOptional, IsDateString } from 'class-validator';

export class UpdateBatchDto {
  @IsDateString()
  @IsOptional()
  manufacturedAt?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
