import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateRoleDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Role name must be a string' })
  @Length(2, 50, { message: 'Role name must be between 2 and 50 characters' })
  @IsNotEmpty({ message: 'Role name is required' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsOptional()
  @IsArray({ message: 'Permissions must be an array of strings' })
  @IsString({ each: true, message: 'Each permission must be a string' })
  permissions?: string[];
}
