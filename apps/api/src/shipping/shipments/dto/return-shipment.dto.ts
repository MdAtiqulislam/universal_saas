import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReturnShipmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  returnReason!: string;

  @IsString()
  @IsOptional()
  location?: string;
}
