import { Injectable, BadRequestException } from '@nestjs/common';

export interface SupportedActionDefinition {
  actionType: string;
  name: string;
  description: string;
  category: string;
  parameterSchema: Record<string, unknown>;
}

@Injectable()
export class ActionCatalogService {
  private readonly supportedActions: Map<string, SupportedActionDefinition> =
    new Map();

  constructor() {
    this.registerActions([
      {
        actionType: 'create_notification',
        name: 'Create Notification',
        description:
          'Enqueues a user or channel notification intent for fulfillment',
        category: 'Communication',
        parameterSchema: {
          recipientUserId: 'string (optional)',
          title: 'string (required)',
          body: 'string (required)',
          severity: 'string (optional)',
        },
      },
      {
        actionType: 'send_email',
        name: 'Send Email Notification',
        description:
          'Sends an email via the M43 Omnichannel Notification Platform',
        category: 'Communication',
        parameterSchema: {
          recipientUserId: 'string (optional)',
          recipientEmail: 'string (optional)',
          templateKey: 'string (optional)',
          subject: 'string (optional)',
          body: 'string (optional)',
          payload: 'object (optional)',
        },
      },
      {
        actionType: 'send_push',
        name: 'Send Push Notification',
        description:
          'Sends a mobile push notification via the M43 Notification Platform',
        category: 'Communication',
        parameterSchema: {
          recipientUserId: 'string (required)',
          title: 'string (required)',
          body: 'string (required)',
          payload: 'object (optional)',
        },
      },
      {
        actionType: 'send_sms',
        name: 'Send SMS Notification',
        description: 'Sends an SMS message via the M43 Notification Platform',
        category: 'Communication',
        parameterSchema: {
          recipientUserId: 'string (optional)',
          recipientPhone: 'string (optional)',
          body: 'string (required)',
          payload: 'object (optional)',
        },
      },
      {
        actionType: 'send_digest',
        name: 'Send Notification Digest',
        description: 'Aggregates and delivers batched notifications to a user',
        category: 'Communication',
        parameterSchema: {
          recipientUserId: 'string (required)',
          digestType: 'string (required)',
          items: 'array (required)',
        },
      },
      {
        actionType: 'publish_integration_event',
        name: 'Publish Integration Event',
        description:
          'Publishes a domain event to the M39 Integration Event Bus',
        category: 'Integration',
        parameterSchema: {
          eventName: 'string (required)',
          resourceType: 'string (required)',
          resourceId: 'string (optional)',
          payload: 'object (required)',
        },
      },
      {
        actionType: 'send_webhook',
        name: 'Send Outbound Webhook',
        description:
          'Dispatches payload to a registered M39 outbound webhook subscription',
        category: 'Integration',
        parameterSchema: {
          subscriptionId: 'string (optional)',
          endpoint: 'string (optional)',
          payload: 'object (required)',
        },
      },
      {
        actionType: 'create_task',
        name: 'Create Task',
        description: 'Creates an operational or business follow-up task',
        category: 'Operations',
        parameterSchema: {
          title: 'string (required)',
          assigneeUserId: 'string (optional)',
          dueDate: 'string (optional)',
          priority: 'string (optional)',
        },
      },
      {
        actionType: 'update_variables',
        name: 'Update Context Variables',
        description:
          'Mutates execution variables for subsequent workflow branches',
        category: 'Logic',
        parameterSchema: {
          variables: 'object (required)',
        },
      },
      {
        actionType: 'search_records',
        name: 'Search Records',
        description:
          'Executes unified discovery query and stores matching records in context',
        category: 'Discovery',
        parameterSchema: {
          query: 'string (optional)',
          scope: 'string (optional)',
          limit: 'number (optional)',
        },
      },
      {
        actionType: 'evaluate_search_alert',
        name: 'Evaluate Search Alert',
        description:
          'Triggers on-demand evaluation of a configured search alert',
        category: 'Discovery',
        parameterSchema: {
          alertId: 'string (required)',
        },
      },
      {
        actionType: 'run_analytics_report',
        name: 'Run Analytics Report',
        description:
          'Executes a saved analytics report and stores results in workflow execution context',
        category: 'Analytics',
        parameterSchema: {
          savedReportId: 'string (required)',
        },
      },
      {
        actionType: 'evaluate_kpi',
        name: 'Evaluate KPI Metric',
        description:
          'Calculates an aggregated metric from an analytics dataset to trigger conditional branches',
        category: 'Analytics',
        parameterSchema: {
          definitionKey: 'string (required)',
          measureName: 'string (required)',
          aggregation: 'string (required)',
          filterAst: 'object (optional)',
        },
      },
      {
        actionType: 'start_import',
        name: 'Start Bulk Data Import',
        description:
          'Triggers an asynchronous bulk data import through the Data Operations Platform',
        category: 'Data Operations',
        parameterSchema: {
          operationKey: 'string (required)',
          fileContent: 'string (required)',
          format: 'string (optional)',
          mode: 'string (optional)',
        },
      },
      {
        actionType: 'start_export',
        name: 'Start Bulk Data Export',
        description:
          'Triggers an asynchronous bulk data export through the Data Operations Platform',
        category: 'Data Operations',
        parameterSchema: {
          operationKey: 'string (required)',
          fields: 'array (optional)',
          filters: 'object (optional)',
          format: 'string (optional)',
        },
      },
    ]);
  }

  private registerActions(defs: SupportedActionDefinition[]) {
    for (const def of defs) {
      this.supportedActions.set(def.actionType, def);
    }
  }

  listSupportedActions(): SupportedActionDefinition[] {
    return Array.from(this.supportedActions.values());
  }

  isSupportedAction(actionType: string): boolean {
    return this.supportedActions.has(actionType);
  }

  assertSupportedAction(actionType: string): void {
    if (!this.isSupportedAction(actionType)) {
      throw new BadRequestException(`Unsupported action type: "${actionType}"`);
    }
  }
}
