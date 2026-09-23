# 13. Scheduled Notification Dispatches

## Future Dispatch Scheduling (`INV-471`)

The `NotificationSchedulingService` enables scheduled campaigns, invoice reminders, and future customer follow-ups:

- **Persistence**: Stored in `NotificationSchedule` in `PENDING` state with target `sendAt: DateTime`.
- **M36 Job Integration**:
  - Leverages `M36 JobService` with job type `notification.scheduled.execute`.
- **Atomic State Transitions**:
  - When the execution timestamp arrives, the schedule row transitions atomically to `EXECUTED` before initiating `NotificationsService.notify`.
  - Prevents race conditions or double dispatching across concurrent job runner instances.
- **Cancellation**:
  - Schedulers can cancel pending notifications via `DELETE /api/v1/notifications/schedules/:id`.
