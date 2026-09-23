import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SupplierAddressType } from '@prisma/client';

export class CreateAddressDto {
  @IsEnum(SupplierAddressType)
  @IsOptional()
  type?: SupplierAddressType = SupplierAddressType.BILLING;

  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  line1!: string;

  @IsString()
  @IsOptional()
  @Length(2, 255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  line2?: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  city!: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  state?: string;

  @IsString()
  @IsOptional()
  @Length(2, 20)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  postalCode?: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 10)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  country!: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = false;
}
