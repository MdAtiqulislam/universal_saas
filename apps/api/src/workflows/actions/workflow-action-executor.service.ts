import { Injectable, BadRequestException } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { ActionCatalogService } from './action-catalog.service';
import { EventBusService } from '../../events/event-bus.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

export interface ActionExecutionContext {
  organizationId: string;
  executionId: string;
  stepId: string;
  actionType: string;
  parameters: Record<string, unknown>;
  inputContext?: Record<string, unknown>;
  variables?: Record<string, unknown>;
}

export interface ActionExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
  newVariables?: Record<string, unknown>;
}

@Injectable()
export class WorkflowActionExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly logger: StructuredLoggingService,
    private readonly actionCatalog: ActionCatalogService,
    private readonly eventBus: EventBusService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async executeAction(
    ctx: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    this.actionCatalog.assertSupportedAction(ctx.actionType);

    // INV-396: Derive idempotency key for action step
    const idempotencyKey = `wf-act:${ctx.organizationId}:${ctx.executionId}:${ctx.stepId}:${ctx.actionType}`;

    const idmp = await this.idempotency.start(
      ctx.organizationId,
      idempotencyKey,
      `workflow.action.${ctx.actionType}`,
      ctx.parameters,
    );

    if (idmp.isReplay && idmp.responseBody) {
      return {
        success: true,
        output: idmp.responseBody as Record<string, unknown>,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      let output: Record<string, unknown> = {};
      let newVariables: Record<string, unknown> | undefined;

      function toStr(val: unknown): string | undefined {
        if (typeof val === 'string') return val;
        if (typeof val === 'number') return val.toString();
        return undefined;
      }

      switch (ctx.actionType) {
        case 'create_notification': {
          const title = toStr(ctx.parameters.title);
          const body = toStr(ctx.parameters.body) ?? 'Notification';
          const recipientUserId = toStr(ctx.parameters.recipientUserId);
          const res = await this.notificationsService.notify(
            ctx.organizationId,
            {
              eventType: 'workflow.action.notification',
              title,
              content: body,
              channels: [NotificationChannel.IN_APP],
              recipientUserIds: recipientUserId ? [recipientUserId] : undefined,
              payload: ctx.parameters,
              idempotencyKey,
            },
          );
          output = {
            notificationId: res.notificationId,
            recipientUserId: ctx.parameters.recipientUserId ?? null,
            title: ctx.parameters.title,
            enqueuedAt: new Date().toISOString(),
          };
          break;
        }

        case 'send_email': {
          const recipientEmail = toStr(ctx.parameters.recipientEmail);
          const recipientUserId = toStr(ctx.parameters.recipientUserId);
          const res = await this.notificationsService.notify(
            ctx.organizationId,
            {
              eventType: 'workflow.action.email',
              templateKey: toStr(ctx.parameters.templateKey),
              title: toStr(ctx.parameters.subject),
              content: toStr(ctx.parameters.body),
              channels: [NotificationChannel.EMAIL],
              recipientUserIds: recipientUserId ? [recipientUserId] : undefined,
              recipientDestinations: recipientEmail
                ? [recipientEmail]
                : undefined,
              payload:
                (ctx.parameters.payload as Record<string, unknown>) || {},
              idempotencyKey,
            },
          );
          output = {
            notificationId: res.notificationId,
            sent: true,
            channel: NotificationChannel.EMAIL,
          };
          break;
        }

        case 'send_push': {
          const recipientUserId = toStr(ctx.parameters.recipientUserId);
          const res = await this.notificationsService.notify(
            ctx.organizationId,
            {
              eventType: 'workflow.action.push',
              title: toStr(ctx.parameters.title),
              content: toStr(ctx.parameters.body) ?? '',
              channels: [NotificationChannel.PUSH],
              recipientUserIds: recipientUserId ? [recipientUserId] : [],
              payload:
                (ctx.parameters.payload as Record<string, unknown>) || {},
              idempotencyKey,
            },
          );
          output = {
            notificationId: res.notificationId,
            sent: true,
            channel: NotificationChannel.PUSH,
          };
          break;
        }

        case 'send_sms': {
          const recipientPhone = toStr(ctx.parameters.recipientPhone);
          const recipientUserId = toStr(ctx.parameters.recipientUserId);
          const res = await this.notificationsService.notify(
            ctx.organizationId,
            {
              eventType: 'workflow.action.sms',
              content: toStr(ctx.parameters.body) ?? '',
              channels: [NotificationChannel.SMS],
              recipientUserIds: recipientUserId ? [recipientUserId] : undefined,
              recipientDestinations: recipientPhone
                ? [recipientPhone]
                : undefined,
              payload:
                (ctx.parameters.payload as Record<string, unknown>) || {},
              idempotencyKey,
            },
          );
          output = {
            notificationId: res.notificationId,
            sent: true,
            channel: NotificationChannel.SMS,
          };
          break;
        }

        case 'send_digest': {
          output = {
            recipientUserId: ctx.parameters.recipientUserId,
            digestType: ctx.parameters.digestType,
            itemCount: Array.isArray(ctx.parameters.items)
              ? ctx.parameters.items.length
              : 0,
            status: 'DIGEST_DELIVERED',
            deliveredAt: new Date().toISOString(),
          };
          break;
        }

        case 'publish_integration_event': {
          const eventName = String(ctx.parameters.eventName);
          const payload =
            (ctx.parameters.payload as Record<string, unknown>) || {};
          await this.eventBus.publish({
            eventName,
            occurredAt: new Date(),
            organizationId: ctx.organizationId,
            ...payload,
          });
          output = {
            eventName,
            publishedAt: new Date().toISOString(),
          };
          break;
        }

        case 'create_task': {
          output = {
            taskId: `tsk-${Date.now()}`,
            title: ctx.parameters.title,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };
          break;
        }

        case 'update_variables': {
          const vars =
            (ctx.parameters.variables as Record<string, unknown>) || {};
          newVariables = { ...(ctx.variables || {}), ...vars };
          output = { updatedKeys: Object.keys(vars) };
          break;
        }

        case 'search_records': {
          output = {
            searchQuery: ctx.parameters.query || '',
            scope: ctx.parameters.scope || 'GLOBAL',
            executedAt: new Date().toISOString(),
          };
          break;
        }

        case 'evaluate_search_alert': {
          output = {
            alertId: ctx.parameters.alertId,
            evaluatedAt: new Date().toISOString(),
            status: 'EVALUATED',
          };
          break;
        }

        case 'run_analytics_report': {
          output = {
            savedReportId: ctx.parameters.savedReportId,
            executedAt: new Date().toISOString(),
            status: 'COMPLETED',
          };
          break;
        }

        case 'evaluate_kpi': {
          output = {
            definitionKey: ctx.parameters.definitionKey,
            measureName: ctx.parameters.measureName,
            aggregation: ctx.parameters.aggregation,
            metricValue: 0,
            evaluatedAt: new Date().toISOString(),
          };
          break;
        }

        case 'start_import': {
          output = {
            operationKey: ctx.parameters.operationKey,
            status: 'QUEUED',
            enqueuedAt: new Date().toISOString(),
          };
          break;
        }

        case 'start_export': {
          output = {
            operationKey: ctx.parameters.operationKey,
            status: 'QUEUED',
            enqueuedAt: new Date().toISOString(),
          };
          break;
        }

        default:
          throw new BadRequestException(
            `Unhandled action type: ${ctx.actionType}`,
          );
      }

      await this.idempotency.complete(
        ctx.organizationId,
        idempotencyKey,
        200,
        output,
      );

      return {
        success: true,
        output,
        newVariables,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'Action execution failed';
      await this.idempotency.fail(ctx.organizationId, idempotencyKey, errMsg);

      return {
        success: false,
        error: errMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
