# 06. SMS Telephony Engine

## Telephony Architecture

SMS dispatches provide critical alerts, MFA codes, and time-sensitive operational updates:

- **E.164 Formatting Validation (`INV-455`)**:
  - All recipient phone numbers must conform strictly to international E.164 format: `^\+[1-9]\d{6,14}$`.
  - Malformed numbers are rejected prior to network transmission, preventing wasted telephony spend.
- **Provider Gateway Abstraction**:
  - Backed by `SandboxSmsProviderAdapter` (emulating Twilio, Sinch, AWS SNS).
  - Handles transient carrier congestion (`*0000` simulation) versus permanent invalid numbers.
- **Entitlement Metering**:
  - Telephony dispatches verify tenant entitlement and deduct metered usage units in M42 Billing.
