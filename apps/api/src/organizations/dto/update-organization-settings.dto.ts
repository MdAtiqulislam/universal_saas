import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @IsOptional()
  @IsString({ message: 'Currency must be a string code' })
  @Length(3, 3, { message: 'Currency must be a 3-letter ISO code (e.g. USD)' })
  currency?: string;

  @IsOptional()
  @IsString({ message: 'Timezone must be a string identifier' })
  timezone?: string;

  @IsOptional()
  @IsInt({ message: 'Fiscal year start must be an integer month (1-12)' })
  @Min(1, {
    message: 'Fiscal year start must be between 1 (January) and 12 (December)',
  })
  @Max(12, {
    message: 'Fiscal year start must be between 1 (January) and 12 (December)',
  })
  fiscalYearStart?: number;

  @IsOptional()
  @IsObject({ message: 'Custom fields must be a JSON object' })
  customFields?: Record<string, unknown>;
}
