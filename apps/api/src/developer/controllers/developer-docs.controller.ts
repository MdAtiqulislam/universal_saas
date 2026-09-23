import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ApiContractService } from '../services/api-contract.service';

@Controller('developer')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DeveloperDocsController {
  constructor(private readonly contractService: ApiContractService) {}

  @Get('docs/openapi.json')
  @RequirePermissions('developer.api.docs.view')
  getOpenApiSpec() {
    return this.contractService.getOpenApiSpec();
  }

  @Get('versions')
  @RequirePermissions('developer.versions.view')
  getVersions() {
    const data = this.contractService.getApiVersions();
    return {
      success: true,
      data,
    };
  }

  @Get('webhooks/docs')
  @RequirePermissions('developer.webhooks.view')
  getWebhookDocs() {
    return {
      success: true,
      data: {
        title: 'M39 Outbound & Inbound Webhooks Developer Guide',
        deliveryModel: {
          transport: 'HTTPS POST',
          payloadFormat: 'application/json',
          signingAlgorithm: 'HMAC-SHA256',
          signatureHeader: 'X-Webhook-Signature',
          timestampHeader: 'X-Webhook-Timestamp',
          retryPolicy: {
            maxAttempts: 5,
            backoffStrategy: 'Exponential backoff (2^attempt * 15s)',
            deadLetterThreshold: 5,
          },
        },
        signatureVerificationExample: {
          language: 'Node.js (crypto)',
          code: `const crypto = require('crypto');
function verifySignature(payload, signature, secret, timestamp) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(\`\${timestamp}.\${payload}\`);
  const expected = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}`,
        },
        supportedEvents: [
          'customer.created',
          'customer.updated',
          'order.confirmed',
          'order.fulfilled',
          'inventory.threshold_breached',
          'workflow.completed',
          'workflow.failed',
        ],
      },
    };
  }
}
