import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelShipmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  cancellationReason!: string;
}
