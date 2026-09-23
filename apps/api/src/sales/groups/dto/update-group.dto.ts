import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCustomerGroupDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
