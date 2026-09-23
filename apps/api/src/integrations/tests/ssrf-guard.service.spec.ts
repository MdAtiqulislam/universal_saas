import { BadRequestException } from '@nestjs/common';
import { SsrfGuardService } from '../webhooks/ssrf-guard.service';

describe('SsrfGuardService', () => {
  let service: SsrfGuardService;

  beforeEach(() => {
    service = new SsrfGuardService();
  });

  it('should reject non-HTTPS URLs', async () => {
    await expect(
      service.validateEndpoint('http://example.com/webhook'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject invalid URLs', async () => {
    await expect(service.validateEndpoint('not-a-valid-url')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject localhost and 0.0.0.0 by hostname', async () => {
    await expect(
      service.validateEndpoint('https://localhost:8080/webhook'),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.validateEndpoint('https://0.0.0.0:8080/webhook'),
    ).rejects.toThrow(BadRequestException);
  });
});
