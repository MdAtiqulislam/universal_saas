# 12 — Search Alerts Architecture

## Automated Search Monitoring

The `SearchAlert` model configures background monitoring of saved searches:

- `name`: Alert label
- `savedViewId`: Reference to target `SavedView` (`INV-495`)
- `status`: `ACTIVE` | `PAUSED` | `TRIGGERED` | `FAILED`
- `alertIntervalMinutes`: Frequency (e.g. 15m, 60m, 360m, 1440m)
- `notifyChannels`: Target channels (e.g. `['IN_APP', 'EMAIL']`)
- `lastEvaluatedAt`: Last execution timestamp

## Execution Idempotency (`INV-496`)

When triggered, an alert execution records `SearchAlertExecution`:

- Evaluates the query against recent changes.
- Records `executionId = exec_{alertId}_{timeWindow}`.
- If an execution already ran for that time window, duplicate executions are skipped to prevent redundant alerts.
