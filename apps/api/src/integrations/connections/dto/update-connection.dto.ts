import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';

export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['CONNECTED', 'DISCONNECTED', 'ERROR', 'PENDING'])
  status?: string;

  @IsOptional()
  configData?: Record<string, unknown>;
}
