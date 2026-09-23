import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  IsObject,
  IsNumber,
} from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsUrl({ require_tld: true, require_protocol: true })
  endpoint!: string;

  @IsArray()
  @IsString({ each: true })
  subscribedEvents!: string[];

  @IsOptional()
  @IsObject()
  retryPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  timeoutSeconds?: number;
}
