# DOC-18: Notification Architecture

**Version:** 1.0 | **Status:** APPROVED | **Date:** 2026-08-27
**Purpose:** System and user notification design.
**Owner:** Senior Software Architect

## Notification Types

- **Severity:** INFO, SUCCESS, WARNING, ERROR.
- **Entities:** In-App (MVP), Email, SMS (Future), Push (Future).

## Event-Driven Design

Business modules trigger generic events (e.g., `UserCreatedEvent`, `StockLowEvent`).
Notification Listeners pick these up to generate standard notifications. This prevents tight coupling between business logic and the notification service.

## Data Model

- `id`, `organization_id`, `user_id`, `type`, `title`, `message`, `data` (JSONB for variable metadata), `read_at`, `created_at`.
- **UI UX:** Notification Bell (Unread count), Dropdown list (Mark as read, Mark all as read), Dedicated Notification Center page.
