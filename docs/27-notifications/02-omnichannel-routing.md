# 02. Omnichannel Routing Engine

## Routing Architecture

The `ChannelRouterService` resolves channels for each notification intent based on:

1. Requested channels in the dispatch payload.
2. Template-configured channels (if a template is referenced).
3. Recipient opt-in/opt-out preferences (`NotificationPreference`).
4. Quiet hours restrictions (unless bypassed for security alerts).
5. Organization communication policies (`CommunicationPolicy`).

## Channel Selection Precedence

- If explicit channels are passed in the dispatch request, only those channels are candidates.
- If omitted, the published template's supported channels are selected.
- Channels disabled by the recipient's preference are suppressed, unless the notification has priority `URGENT` or `bypassQuietHours: true` (`INV-462`).
