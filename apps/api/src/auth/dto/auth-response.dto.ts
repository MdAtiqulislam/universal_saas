export interface SanitizedUserDto {
  id: string;
  email: string;
  status: string;
  createdAt: Date | string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SanitizedUserDto;
}
