# M03 — Authentication & Identity Architecture Guide

This document defines the authentication architecture, security controls, token lifecycle, session model, and endpoint specifications implemented in **Milestone M03**.

---

## 1. Authentication Architectural Scope

Milestone M03 answers the core question: **"Who is this user?"**  
It deliberately does **NOT** enforce authorization, RBAC permissions, or tenant-level access boundaries (which belong to subsequent milestones).

```
┌─────────────────────────────────────────────────────────────┐
│                       GLOBAL IDENTITY                       │
│  • User (Authentication identity, unique email, credentials)│
│  • Session (Active client login, refresh token hash, expiry)│
└──────────────────────────────┬──────────────────────────────┘
                               │ Authenticated via JwtAuthGuard
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 AUTHENTICATED REQUEST CONTEXT               │
│  • req.user.id (User UUID)                                  │
│  • req.user.sessionId (Session UUID)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Password Security

- **Hashing Algorithm:** Native **Argon2id** (`argon2.argon2id`).
- **Storage:** Stored in `users.password_hash`. Plaintext passwords are never persisted.
- **Timing Attack Mitigation:** Authentication against non-existent accounts executes a dummy Argon2 verification before returning a generic `401 Unauthorized` (`Invalid email or password`).
- **Leakage Prevention:** Passwords and password hashes are strictly omitted from logs, JWT claims, and API responses.

---

## 3. Token Strategy & Replay Protection

### 3.1 Access Token (JWT)

- **Format:** Signed JSON Web Token (HMAC-SHA256).
- **Lifetime:** 15 minutes (`900` seconds).
- **Claims:** Minimal payload containing only session and subject identifiers:
  ```json
  {
    "sub": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "sid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "iat": 1756382400,
    "exp": 1756383300
  }
  ```
  _(Zero PII, email, roles, or organization metadata are embedded in the token)._

### 3.2 Refresh Token & Token Rotation

- **Generation:** High-entropy cryptographically secure random string (`crypto.randomBytes(40).toString("hex")` = 320 bits of entropy).
- **Persistence:** Only the SHA-256 hash (`crypto.createHash("sha256").update(token).digest("hex")`) is saved to `sessions.refresh_token_hash`. Plaintext refresh tokens are never persisted.
- **Rotation Rule:** Each call to `POST /api/v1/auth/refresh` issues a brand-new refresh token and updates `sessions.refresh_token_hash`. The previous token is permanently invalidated.
- **Replay Detection:** If an old or mismatched token is presented, replay detection triggers: the session is **immediately revoked** (`revoked_at = now()`) and rejected with `401 Unauthorized`.

---

## 4. Session Management & Multi-Session Support

- **Database Model:** `sessions` table linked to `users(id)` via `ON DELETE CASCADE`.
- **Multi-Session Support:** A user can be logged in simultaneously on multiple devices (e.g. laptop, mobile).
- **Single Logout (`POST /api/v1/auth/logout`):** Sets `revoked_at = now()` on the active session (`sid`). Other active sessions remain unaffected.
- **Global Logout (`POST /api/v1/auth/logout-all`):** Sets `revoked_at = now()` across all active sessions belonging to `user_id`.

---

## 5. JWT Authentication Guard (`JwtAuthGuard`)

The `JwtAuthGuard` performs end-to-end identity and session validation on every protected route:

1. Extracts Bearer token from `Authorization` header.
2. Validates JWT signature and expiration.
3. Validates required claims (`sub` and `sid`).
4. Resolves `User` from PostgreSQL database where `deletedAt IS NULL`.
5. Rejects inactive or suspended users (`status !== 'ACTIVE'`).
6. Resolves `Session` where `id = sid`, `userId = sub`, and `revokedAt IS NULL`.
7. Rejects expired sessions (`expiresAt <= now()`).
8. Attaches verified `{ id: user.id, sessionId: session.id }` to `req.user`.

---

## 6. API Endpoints Specification

Base path: `/api/v1/auth`

| Endpoint      | Method | Access        | Request Body          | Response Description                                         |
| :------------ | :----- | :------------ | :-------------------- | :----------------------------------------------------------- |
| `/register`   | `POST` | Public        | `{ email, password }` | Sanitized user profile (`201 Created`)                       |
| `/login`      | `POST` | Public        | `{ email, password }` | Access token, refresh token, expiry, user summary (`200 OK`) |
| `/refresh`    | `POST` | Public        | `{ refreshToken }`    | New access token, rotated refresh token, expiry (`200 OK`)   |
| `/logout`     | `POST` | Authenticated | None                  | Revokes active session (`200 OK`)                            |
| `/logout-all` | `POST` | Authenticated | None                  | Revokes all user sessions (`200 OK`)                         |
| `/me`         | `GET`  | Authenticated | None                  | Sanitized current user profile (`200 OK`)                    |

---

## 7. Future Integration Points

- **Rate Limiting (Security Milestone):** Integration hooks reserved for Redis-backed sliding window rate limiters on `/register` (by IP), `/login` (by IP + email), and `/refresh` (by IP + token).
- **RBAC & Multi-Tenancy (M04/M05):** Organization resolution and role/permission evaluation will bind onto `req.user.id` resolved by `JwtAuthGuard`.
