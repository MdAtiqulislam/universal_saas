# ADR-141: Recipient Preferences, Timezone Quiet Hours, and Security Bypass

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M43

## Context

Notification fatigue leads to user dissatisfaction, unsubscribes, and missed critical information. SaaS recipients require granular opt-in/opt-out control over communication channels and quiet hour suppression for non-working hours across diverse global timezones. However, life-safety, authentication (MFA/2FA), and critical security alerts must never be suppressed.

## Decision

1. **Granular Channel Preferences (`INV-460`)**:
   - Recipients configure opt-ins per channel (`inAppEnabled`, `emailEnabled`, `pushEnabled`, `smsEnabled`) and per notification category in `NotificationPreference`.
2. **Timezone-Aware Quiet Hours (`INV-461`)**:
   - Recipients can specify a daily quiet window defined in UTC or their localized timezone (e.g., `22:00` to `07:00`).
   - The evaluation engine accurately calculates time windows spanning midnight boundaries (e.g., 22:00 -> 07:00 next day).
3. **Mandatory Security Alert Bypass (`INV-462`)**:
   - Notifications tagged with priority `URGENT` or marked with `bypassQuietHours: true` (e.g., password resets, fraud detection, account lockouts) bypass quiet hours and recipient channel disablement unconditionally.
4. **Tenant Communication Policies (`INV-463`)**:
   - Organizations define organization-wide guardrails (`CommunicationPolicy`) specifying maximum dispatches per hour, mandatory disclaimer footers, and enforced opt-out headers (RFC 8058).

## Consequences

- Recipients control how and when they receive non-critical notifications.
- Security-critical alerts maintain 100% delivery compliance without being silenced by quiet hours or accidental user toggles.
