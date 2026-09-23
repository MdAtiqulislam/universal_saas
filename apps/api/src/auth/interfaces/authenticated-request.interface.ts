import { Request } from 'express';

export interface AuthenticatedUserContext {
  id: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUserContext;
}
