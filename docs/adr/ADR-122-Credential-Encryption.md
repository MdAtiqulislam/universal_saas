# ADR-122: Integration Credential Encryption

**Status:** Accepted  
**Date:** 2026-09-02  
**Milestone:** M39

## Context

Third-party integration connections require storing sensitive secrets (API keys, bearer tokens, OAuth client secrets, webhook signing keys) for authenticating outbound requests and verifying inbound notifications. These secrets must never reside in plaintext anywhere in the persistent store.

## Decision

1. **Authenticated symmetric encryption (AES-256-GCM)**: All credentials are encrypted using AES-256-GCM prior to database persistence. GCM mode provides both confidentiality and tamper detection via a 16-byte authentication tag.
2. **Unique initialization vectors**: A cryptographically random 12-byte IV is generated per credential and stored alongside the ciphertext and auth tag.
3. **Master encryption key**: Encryption uses `INTEGRATION_MASTER_KEY` (32 bytes). In development, a deterministic fallback ensures test stability.
4. **Fingerprint for non-recoverable lookup**: A 16-character SHA-256 fingerprint is stored for display and deduplication without exposing plaintext.
5. **No secret leakage in APIs**: API endpoints return only the credential ID, type, fingerprint, and metadata. Ciphertext and plaintext secrets are never returned.

## Consequences

- Compromise of database read access does not disclose plaintext integration credentials.
- Tampered ciphertexts trigger authentication tag verification failure upon decryption.
- Secrets are decrypted only immediately prior to executing an authenticated outbound HTTP request.
