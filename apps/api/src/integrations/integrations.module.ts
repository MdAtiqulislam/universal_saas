import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { IntegrationProvidersService } from './providers/integration-providers.service';
import { IntegrationProvidersController } from './providers/integration-providers.controller';
import { IntegrationConnectionsService } from './connections/integration-connections.service';
import { IntegrationConnectionsController } from './connections/integration-connections.controller';
import { CredentialEncryptionService } from './credentials/credential-encryption.service';
import { IntegrationCredentialsService } from './credentials/integration-credentials.service';
import { WebhookSignatureService } from './webhooks/webhook-signature.service';
import { SsrfGuardService } from './webhooks/ssrf-guard.service';
import { WebhookSubscriptionsService } from './webhooks/webhook-subscriptions.service';
import { WebhookSubscriptionsController } from './webhooks/webhook-subscriptions.controller';
import { WebhookDeliveryService } from './webhooks/webhook-delivery.service';
import { InboundWebhookController } from './webhooks/inbound-webhook.controller';
import { ApiKeysService } from './api-keys/api-keys.service';
import { ApiKeysController } from './api-keys/api-keys.controller';
import { IntegrationEventsService } from './events/integration-events.service';
import { IntegrationEventsController } from './events/integration-events.controller';
import { IntegrationHealthService } from './health/integration-health.service';
import { IntegrationHealthController } from './health/integration-health.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    IntegrationProvidersController,
    IntegrationConnectionsController,
    WebhookSubscriptionsController,
    InboundWebhookController,
    ApiKeysController,
    IntegrationEventsController,
    IntegrationHealthController,
  ],
  providers: [
    IntegrationProvidersService,
    IntegrationConnectionsService,
    CredentialEncryptionService,
    IntegrationCredentialsService,
    WebhookSignatureService,
    SsrfGuardService,
    WebhookSubscriptionsService,
    WebhookDeliveryService,
    ApiKeysService,
    IntegrationEventsService,
    IntegrationHealthService,
  ],
  exports: [
    ApiKeysService,
    WebhookDeliveryService,
    IntegrationEventsService,
    WebhookSignatureService,
    IntegrationConnectionsService,
    IntegrationProvidersService,
    CredentialEncryptionService,
  ],
})
export class IntegrationsModule {}
