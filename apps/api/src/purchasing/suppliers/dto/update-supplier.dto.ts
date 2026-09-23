import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsInt,
  IsBoolean,
  Min,
  Length,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateSupplierDto {
  @IsString()
  @IsOptional()
  @Length(2, 200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString()
  @IsOptional()
  @Length(2, 200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  legalName?: string;

  @IsString()
  @IsOptional()
  @Length(2, 50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  taxNumber?: string;

  @IsEmail()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsString()
  @IsOptional()
  @Length(5, 50)
  phone?: string;

  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  paymentTermsDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
