import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsIn,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateCredentialDto {
  @IsUUID()
  @IsNotEmpty()
  connectionId!: string;

  @IsIn(['API_KEY', 'BEARER_TOKEN', 'BASIC_AUTH', 'OAUTH2', 'WEBHOOK_SECRET'])
  credentialType!: string;

  @IsString()
  @IsNotEmpty()
  plaintext!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
