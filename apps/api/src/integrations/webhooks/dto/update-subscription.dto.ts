import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  IsNumber,
} from 'class-validator';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: true, require_protocol: true })
  endpoint?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subscribedEvents?: string[];

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  retryPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  timeoutSeconds?: number;
}
