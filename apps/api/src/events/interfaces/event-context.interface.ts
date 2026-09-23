export interface EventContext {
  readonly organizationId?: string;
  readonly actorUserId?: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}
