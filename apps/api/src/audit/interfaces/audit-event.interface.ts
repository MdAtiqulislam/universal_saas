import { ApplicationEvent } from '../../events/interfaces/application-event.interface';

export interface AuditEvent extends ApplicationEvent {
  readonly organizationId: string;
  readonly actorUserId?: string | null;
  readonly action: string;
  readonly resource: string;
  readonly resourceId?: string | null;
  readonly details?: Record<string, unknown> | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}
