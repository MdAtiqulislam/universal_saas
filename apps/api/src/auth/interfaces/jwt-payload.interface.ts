export interface JwtPayload {
  sub: string; // User.id (UUID)
  sid: string; // Session.id (UUID)
  iat?: number;
  exp?: number;
}
