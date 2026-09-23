export interface AuditLogItem {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  actorUser?: {
    id: string;
    email: string;
  } | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface PaginatedAuditLogs {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
