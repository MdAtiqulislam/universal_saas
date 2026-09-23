import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSerialDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  serialNumber!: string;

  @IsBoolean()
  @IsOptional()
  autoReceive?: boolean = true;
}
