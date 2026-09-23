import { Injectable } from '@nestjs/common';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'refreshtokenhash',
  'refresh_token_hash',
  'authorization',
  'cookie',
  'secret',
  'clientsecret',
  'client_secret',
  'apikey',
  'api_key',
  'token',
  'nationalidreference',
  'national_id_reference',
  'basesalary',
  'base_salary',
  'salary',
]);

export const REDACTED_VALUE = '[REDACTED]';

@Injectable()
export class AuditSanitizerService {
  /**
   * Recursively sanitize any object, array, or primitive, redacting sensitive keys.
   */
  sanitize(input: unknown): unknown {
    if (input === null || input === undefined) {
      return input;
    }

    if (Array.isArray(input)) {
      return input.map((item: unknown) => this.sanitize(item));
    }

    if (typeof input === 'object' && !(input instanceof Date)) {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(
        input as Record<string, unknown>,
      )) {
        const normalizedKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(normalizedKey)) {
          sanitized[key] = REDACTED_VALUE;
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }

      return sanitized;
    }

    return input;
  }
}
