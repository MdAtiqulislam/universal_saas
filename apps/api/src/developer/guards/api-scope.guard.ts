import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_SCOPES_KEY } from '../decorators/require-api-scopes.decorator';
import { ApiKeyContext } from './api-key-auth.guard';

interface RequestWithApiKey {
  apiKey?: ApiKeyContext;
}

@Injectable()
export class ApiScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      API_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithApiKey>();
    const apiKey = request.apiKey;

    if (!apiKey) {
      // If endpoint requires specific API scopes but request is not using an API key
      return true;
    }

    const keyScopes = new Set(apiKey.scopes || []);
    // Admin scope wildcard grants all api.* operations
    if (keyScopes.has('api.admin') || keyScopes.has('admin')) {
      return true;
    }

    const hasAll = requiredScopes.every((scope) => keyScopes.has(scope));
    if (!hasAll) {
      const missing = requiredScopes.filter((s) => !keyScopes.has(s));
      throw new ForbiddenException(
        `Insufficient API scope: missing required scope(s) [${missing.join(', ')}]`,
      );
    }

    return true;
  }
}
