import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Organization name must be a string' })
  @Length(2, 100, {
    message: 'Organization name must be between 2 and 100 characters',
  })
  @IsNotEmpty({ message: 'Organization name is required' })
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString({ message: 'Organization slug must be a string' })
  @Length(2, 50, {
    message: 'Organization slug must be between 2 and 50 characters',
  })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must contain only lowercase alphanumeric characters and hyphens, and cannot start or end with a hyphen',
  })
  @IsNotEmpty({ message: 'Organization slug is required' })
  slug!: string;
}
