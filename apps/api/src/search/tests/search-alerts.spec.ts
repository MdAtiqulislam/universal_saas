/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { SearchAlertsService } from '../services/search-alerts.service';
import { SearchAlertsRepository } from '../repositories/search-alerts.repository';
import { SavedViewsRepository } from '../repositories/saved-views.repository';
import { JobService } from '../../common/jobs/job.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { SearchAlertStatus, NotificationChannel } from '@prisma/client';

describe('SearchAlertsService', () => {
  let service: SearchAlertsService;
  let alertsRepo: jest.Mocked<SearchAlertsRepository>;
  let savedViewsRepo: jest.Mocked<SavedViewsRepository>;
  let jobService: jest.Mocked<JobService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let audit: jest.Mocked<AuditService>;
  let logger: jest.Mocked<StructuredLoggingService>;

  beforeEach(() => {
    alertsRepo = {
      createAlert: jest.fn(),
      findAlertById: jest.fn(),
      listAlerts: jest.fn(),
      updateAlert: jest.fn(),
      deleteAlert: jest.fn(),
      recordExecution: jest.fn(),
      listExecutions: jest.fn(),
    } as any;

    savedViewsRepo = {
      findSavedViewById: jest.fn(),
    } as any;

    jobService = {
      registerHandler: jest.fn(),
      createJob: jest.fn(),
    } as any;

    notificationsService = {
      notify: jest.fn().mockResolvedValue({
        id: 'notif-1',
        channelDeliveries: [{ channel: 'IN_APP', status: 'DELIVERED' }],
      } as any),
    } as any;

    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;

    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    service = new SearchAlertsService(
      alertsRepo,
      savedViewsRepo,
      jobService,
      notificationsService,
      audit,
      logger,
    );
  });

  describe('createAlert (INV-495)', () => {
    it('creates alert referencing a valid saved view within organization and registers M36 job', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue({
        id: 'view-1',
        organizationId: 'org-1',
        name: 'Urgent Tickets',
      } as any);

      alertsRepo.createAlert.mockResolvedValue({
        id: 'alert-1',
        organizationId: 'org-1',
        userId: 'user-1',
        savedViewId: 'view-1',
        name: 'New Urgent Tickets',
        status: SearchAlertStatus.ACTIVE,
      } as any);

      jobService.createJob.mockResolvedValue({ id: 'job-1' } as any);

      const result = await service.createAlert('org-1', 'user-1', {
        savedViewId: 'view-1',
        name: 'New Urgent Tickets',
      });

      expect(result.id).toBe('alert-1');
      expect(jobService.createJob).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          jobType: 'search.alert.execute',
          payload: { alertId: 'alert-1' },
        }),
        undefined,
      );
    });

    it('rejects alert referencing invalid or non-existent saved view (INV-495)', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue(null);

      await expect(
        service.createAlert('org-1', 'user-1', {
          savedViewId: 'nonexistent-view',
          name: 'Invalid Alert',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('evaluateAlert (INV-496, INV-497)', () => {
    it('evaluates alert and dispatches notification via M43 NotificationsService', async () => {
      const alert = {
        id: 'alert-1',
        organizationId: 'org-1',
        userId: 'user-1',
        status: SearchAlertStatus.ACTIVE,
        alertIntervalMinutes: 60,
        notifyChannels: ['EMAIL', 'IN_APP'],
        name: 'Daily High Value Leads',
        savedView: { name: 'High Value Leads' },
      };

      alertsRepo.findAlertById.mockResolvedValue(alert as any);
      alertsRepo.recordExecution.mockResolvedValue({
        id: 'exec-record-1',
      } as any);

      const res = await service.evaluateAlert('alert-1', 'custom-exec-id-123');

      expect(res.status).toBe(SearchAlertStatus.TRIGGERED);
      expect(res.executionId).toBe('custom-exec-id-123');
      expect(notificationsService.notify).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          eventType: 'search.alert.matched',
          recipientUserIds: ['user-1'],
          channels: expect.arrayContaining([
            NotificationChannel.EMAIL,
            NotificationChannel.IN_APP,
          ]),
        }),
      );
    });
  });
});
