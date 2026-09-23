import {
  IsString,
  MaxLength,
  IsOptional,
  IsEmail,
  IsUUID,
  IsInt,
  Min,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  legalName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  taxNumber?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  phone?: string;

  @IsUUID()
  @IsOptional()
  customerGroupId?: string | null;

  @IsUUID()
  @IsOptional()
  currencyId?: string | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  paymentTermsDays?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  creditLimit?: number | null;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
