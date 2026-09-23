import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateContactDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

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

  @IsString()
  @IsOptional()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  designation?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
