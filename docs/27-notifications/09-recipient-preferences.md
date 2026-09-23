# 09. Recipient Communication Preferences

## Preference Matrix (`INV-460`)

Recipients hold fine-grained authority over which channels may contact them:

- **Global Channel Toggles**:
  - `inAppEnabled`: boolean
  - `emailEnabled`: boolean
  - `pushEnabled`: boolean
  - `smsEnabled`: boolean
- **Category Preferences**:
  - Optional granular overrides for notification categories (e.g. `billing`, `marketing`, `operations`).
- **Precedence Hierarchy**:
  1. System Security Alerts (URGENT / bypassQuietHours) bypass all recipient channel opt-outs.
  2. Organization Communication Policies define maximum frequency and hard exclusions.
  3. Recipient Preferences determine channel eligibility for standard messages.
  4. Dispatch Request specifies target intent.
