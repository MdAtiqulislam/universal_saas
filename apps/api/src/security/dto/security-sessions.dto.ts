import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class RevokeSessionDto {
  @IsOptional()
  @IsString()
  reason?: string = 'Administrative revocation';
}

export class RevokeUserSessionsDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  reason?: string = 'Global logout across all devices';
}

export class SessionQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}
