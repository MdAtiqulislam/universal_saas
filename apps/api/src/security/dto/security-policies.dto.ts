import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class UpdateSecurityPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxFailedLogins?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  lockoutDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  sessionLifetimeHours?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  sessionIdleTimeoutMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(64)
  passwordMinLength?: number;

  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireNumbers?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireSymbols?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24)
  passwordHistoryRetention?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(10000)
  apiRateLimitPerMinute?: number;

  @IsOptional()
  @IsBoolean()
  mfaEnforced?: boolean;
}
