import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTransferDto {
  @IsUUID()
  @IsNotEmpty()
  sourceLocationId!: string;

  @IsUUID()
  @IsNotEmpty()
  destinationLocationId!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason?: string;
}
