import { Test, TestingModule } from '@nestjs/testing';
import { AlertingService } from '../alerting/alerting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  AlertSeverity,
  AlertRuleStatus,
  AlertEventStatus,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('M38: Alerting Rules, Triggers & Deduplication (INV-335, INV-336, INV-337, INV-338)', () => {
  let alertingService: AlertingService;
  let prismaMock: any;
  let auditMock: any;

  const mockOrgId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    prismaMock = {
      operationalAlertRule: {
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: 'rule-uuid-1',
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: args.where.id,
            ...args.data,
          }),
        ),
      },
      operationalAlertEvent: {
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: 'event-uuid-1',
            ...args.data,
            triggeredAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: args.where.id,
            ...args.data,
          }),
        ),
      },
    };
    auditMock = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    alertingService = module.get<AlertingService>(AlertingService);
  });

  describe('Alert Rule Creation (INV-335)', () => {
    it('1. should create an alert rule with positive threshold and window', async () => {
      const rule = await alertingService.createRule({
        name: 'High Error Rate Alert',
        metricKey: 'http_5xx_rate',
        threshold: 5.0,
        windowSeconds: 60,
        severity: AlertSeverity.CRITICAL,
        organizationId: mockOrgId,
        cooldownSeconds: 300,
      });

      expect(rule.status).toBe(AlertRuleStatus.ACTIVE);
      expect(rule.threshold).toBe(5.0);
    });

    it('2. should reject rules with non-positive threshold or window (INV-335)', async () => {
      await expect(
        alertingService.createRule({
          name: 'Invalid Rule',
          metricKey: 'error_count',
          threshold: 0,
          windowSeconds: 60,
          severity: AlertSeverity.WARNING,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Cooldown & Deduplication (INV-336)', () => {
    it('3. should suppress duplicate alert triggers within cooldown window', async () => {
      prismaMock.operationalAlertRule.findUnique.mockResolvedValueOnce({
        id: 'rule-1',
        status: AlertRuleStatus.ACTIVE,
        threshold: 10,
        cooldownSeconds: 300,
        organizationId: mockOrgId,
      });

      // Recent event triggered 60 seconds ago (cooldown is 300s)
      prismaMock.operationalAlertEvent.findFirst.mockResolvedValueOnce({
        id: 'event-prev',
        alertRuleId: 'rule-1',
        status: AlertEventStatus.TRIGGERED,
        triggeredAt: new Date(Date.now() - 60 * 1000),
      });

      await alertingService.evaluateRule('rule-1', 15); // Above threshold

      expect(prismaMock.operationalAlertEvent.create).not.toHaveBeenCalled();
    });

    it('4. should trigger alert when outside cooldown window', async () => {
      prismaMock.operationalAlertRule.findUnique.mockResolvedValueOnce({
        id: 'rule-1',
        status: AlertRuleStatus.ACTIVE,
        threshold: 10,
        cooldownSeconds: 300,
        organizationId: mockOrgId,
      });

      // Event triggered 400 seconds ago (past 300s cooldown)
      prismaMock.operationalAlertEvent.findFirst.mockResolvedValueOnce({
        id: 'event-prev',
        alertRuleId: 'rule-1',
        status: AlertEventStatus.TRIGGERED,
        triggeredAt: new Date(Date.now() - 400 * 1000),
      });

      await alertingService.evaluateRule('rule-1', 15);

      expect(prismaMock.operationalAlertEvent.create).toHaveBeenCalled();
    });
  });

  describe('Alert Event Lifecycle (INV-337, INV-338)', () => {
    it('5. should transition TRIGGERED alert to ACKNOWLEDGED', async () => {
      prismaMock.operationalAlertEvent.findUnique.mockResolvedValueOnce({
        id: 'evt-1',
        status: AlertEventStatus.TRIGGERED,
        organizationId: mockOrgId,
      });

      const acked = await alertingService.acknowledgeAlert('evt-1', 'user-1');
      expect(acked.status).toBe(AlertEventStatus.ACKNOWLEDGED);
      expect(acked.acknowledgedAt).toBeDefined();
    });

    it('6. should transition alert to RESOLVED with resolvedAt populated (INV-338)', async () => {
      prismaMock.operationalAlertEvent.findUnique.mockResolvedValueOnce({
        id: 'evt-1',
        status: AlertEventStatus.ACKNOWLEDGED,
        organizationId: mockOrgId,
      });

      const resolved = await alertingService.resolveAlert('evt-1', 'user-1');
      expect(resolved.status).toBe(AlertEventStatus.RESOLVED);
      expect(resolved.resolvedAt).toBeDefined();
    });
  });
});
