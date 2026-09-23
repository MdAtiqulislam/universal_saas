export interface SecurityDashboardSummary {
  kpis: {
    totalLoginAttempts24h: number;
    successfulLogins24h: number;
    failedLogins24h: number;
    authSuccessRatePercentage: number;
    activeSessionsCount: number;
    lockedAccountsCount: number;
    highCriticalIncidents24h: number;
    rateLimitViolations24h: number;
  };
  recentEvents: SecurityEventItem[];
}

export interface SecurityEventItem {
  id: string;
  organizationId: string | null;
  category: string;
  eventType: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  actorUserId: string | null;
  actorUser?: {
    id: string;
    email: string;
  };
  ipAddress: string | null;
  userAgent: string | null;
  resource: string | null;
  resourceId: string | null;
  details?: Record<string, any>;
  createdAt: string;
}

export interface UserSessionItem {
  id: string;
  userId: string;
  userEmail: string;
  userAgent: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  revokedAt: string | null;
  revokedReason: string | null;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface SecurityPolicyConfig {
  id: string;
  organizationId: string;
  maxFailedLogins: number;
  lockoutDurationMinutes: number;
  sessionLifetimeHours: number;
  sessionIdleTimeoutMinutes: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  passwordHistoryRetention: number;
  apiRateLimitPerMinute: number;
  mfaEnforced: boolean;
  createdAt: string;
  updatedAt: string;
}
