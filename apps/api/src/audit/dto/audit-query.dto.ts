import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit: number = 50;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Action must be a string' })
  action?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Resource must be a string' })
  resource?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Actor user ID must be a valid UUID' })
  actorUserId?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'From date must be a valid ISO 8601 date string' },
  )
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'To date must be a valid ISO 8601 date string' })
  to?: string;
}
