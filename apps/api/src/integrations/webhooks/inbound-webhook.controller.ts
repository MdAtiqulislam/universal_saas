import {
  Body,
  Controller,
  Headers,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { JobService } from '../../common/jobs/job.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { WebhookSignatureService } from './webhook-signature.service';

const INBOUND_WEBHOOK_JOB = 'INBOUND_WEBHOOK_PROCESS';

@Controller('webhooks/inbound')
export class InboundWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly jobService: JobService,
    private readonly logger: StructuredLoggingService,
    private readonly signatureService: WebhookSignatureService,
  ) {
    this.jobService.registerHandler(
      INBOUND_WEBHOOK_JOB,
      (payload, onProgress) =>
        this.processInboundEvent(
          payload as { inboundEventId: string; organizationId: string },
          onProgress,
        ),
    );
  }

  @Post(':provider/:connectionKey')
  async receiveWebhook(
    @Param('provider') provider: string,
    @Param('connectionKey') connectionKey: string,
    @Headers('x-webhook-signature') signatureHeader: string | undefined,
    @Headers('x-webhook-timestamp') timestampHeader: string | undefined,
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<{ received: boolean; eventId?: string }> {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: {
        name: connectionKey,
        deletedAt: null,
        provider: { providerKey: provider },
      },
      include: {
        credentials: { where: { credentialType: 'WEBHOOK_SECRET' }, take: 1 },
      },
    });

    if (!connection)
      throw new NotFoundException('Integration connection not found');

    if (
      connection.credentials.length > 0 &&
      signatureHeader &&
      timestampHeader
    ) {
      const rawBody =
        req.body && Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(body);
      const timestamp = parseInt(timestampHeader, 10);
      const isValid = this.signatureService.verifySignature(
        rawBody,
        signatureHeader,
        connection.credentials[0].encryptedValue,
        timestamp,
      );
      if (!isValid)
        throw new UnauthorizedException('Invalid webhook signature');
    }

    const eventPayload = body as Record<string, unknown>;
    const providerEventId =
      (eventPayload['id'] as string) ||
      (eventPayload['event_id'] as string) ||
      `${provider}-${Date.now()}`;
    const eventType =
      (eventPayload['type'] as string) ||
      (eventPayload['event_type'] as string) ||
      'unknown';

    const idempotencyKey = `inbound-webhook:${connection.id}:${providerEventId}`;
    const idempotency = await this.idempotency.start(
      connection.organizationId,
      idempotencyKey,
      'INBOUND_WEBHOOK_RECEIVE',
      { providerEventId, eventType },
    );
    if (idempotency.isReplay) return { received: true };

    const inboundEvent = await this.prisma.inboundWebhookEvent.upsert({
      where: {
        connectionId_providerEventId: {
          connectionId: connection.id,
          providerEventId,
        },
      },
      create: {
        organizationId: connection.organizationId,
        connectionId: connection.id,
        providerEventId,
        eventType,
        rawPayload: eventPayload as never,
        status: 'RECEIVED',
        receivedAt: new Date(),
      },
      update: {},
    });

    await this.jobService.createJob(connection.organizationId, {
      jobType: INBOUND_WEBHOOK_JOB,
      payload: {
        inboundEventId: inboundEvent.id,
        organizationId: connection.organizationId,
      },
    });

    this.logger.log({
      level: 'INFO',
      message: 'Inbound webhook received',
      module: 'Integrations',
      event: 'INBOUND_WEBHOOK_RECEIVED',
      organizationId: connection.organizationId,
      provider,
      connectionId: connection.id,
      eventType,
      providerEventId,
    });

    return { received: true, eventId: inboundEvent.id };
  }

  private async processInboundEvent(
    payload: { inboundEventId: string; organizationId: string },
    onProgress: (percent: number) => Promise<void>,
  ): Promise<{ processed: boolean }> {
    await onProgress(20);

    const event = await this.prisma.inboundWebhookEvent.findUnique({
      where: { id: payload.inboundEventId },
    });

    if (
      !event ||
      event.status === 'PROCESSED' ||
      event.status === 'DUPLICATE'
    ) {
      return { processed: false };
    }

    try {
      await this.prisma.inboundWebhookEvent.update({
        where: { id: payload.inboundEventId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
      await onProgress(100);
      return { processed: true };
    } catch (e: unknown) {
      const errorMsg =
        e instanceof Error ? e.message : 'Unknown processing error';
      await this.prisma.inboundWebhookEvent.update({
        where: { id: payload.inboundEventId },
        data: {
          status: 'FAILED',
          processingError: errorMsg,
        },
      });
      throw e;
    }
  }
}
