import { Test, TestingModule } from '@nestjs/testing';
import {
  AuditSanitizerService,
  REDACTED_VALUE,
} from './audit-sanitizer.service';

describe('AuditSanitizerService', () => {
  let sanitizer: AuditSanitizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditSanitizerService],
    }).compile();

    sanitizer = module.get<AuditSanitizerService>(AuditSanitizerService);
  });

  it('1. should redact sensitive top-level fields', () => {
    const input = {
      email: 'user@example.com',
      password: 'secretPassword123!',
      passwordHash: '$argon2id$...',
      accessToken: 'eyJhbGciOi...',
      refreshToken: 'f83a0...',
      apiKey: 'key_live_12345',
      secret: 'shhh',
    };

    const result = sanitizer.sanitize(input);

    expect(result).toEqual({
      email: 'user@example.com',
      password: REDACTED_VALUE,
      passwordHash: REDACTED_VALUE,
      accessToken: REDACTED_VALUE,
      refreshToken: REDACTED_VALUE,
      apiKey: REDACTED_VALUE,
      secret: REDACTED_VALUE,
    });
  });

  it('2. should recursively redact deeply nested sensitive keys', () => {
    const input = {
      level1: {
        name: 'test',
        level2: {
          authorization: 'Bearer my-jwt-token',
          level3: {
            clientSecret: 'topsecret',
            token: 'abc123xyz',
            publicInfo: 'visible',
          },
        },
      },
    };

    const result = sanitizer.sanitize(input);

    expect(result).toEqual({
      level1: {
        name: 'test',
        level2: {
          authorization: REDACTED_VALUE,
          level3: {
            clientSecret: REDACTED_VALUE,
            token: REDACTED_VALUE,
            publicInfo: 'visible',
          },
        },
      },
    });
  });

  it('3. should redact sensitive keys inside arrays', () => {
    const input = [
      { id: '1', password: 'p1' },
      { id: '2', refreshTokenHash: 'hash2' },
      { id: '3', cookie: 'session_cookie_123' },
    ];

    const result = sanitizer.sanitize(input);

    expect(result).toEqual([
      { id: '1', password: REDACTED_VALUE },
      { id: '2', refreshTokenHash: REDACTED_VALUE },
      { id: '3', cookie: REDACTED_VALUE },
    ]);
  });

  it('4. should handle null, undefined, and primitive values safely', () => {
    expect(sanitizer.sanitize(null)).toBeNull();
    expect(sanitizer.sanitize(undefined)).toBeUndefined();
    expect(sanitizer.sanitize(42)).toBe(42);
    expect(sanitizer.sanitize('hello')).toBe('hello');
  });
});
