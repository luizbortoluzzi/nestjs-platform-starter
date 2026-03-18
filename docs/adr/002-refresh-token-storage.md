# ADR-002: Refresh token storage strategy

**Status:** Accepted

## Context

The authentication system issues JWT refresh tokens with a 7-day lifetime.
For security, refresh tokens must be revocable (logout must actually invalidate
the session) and resistant to token reuse attacks (if a stolen token is used, the
legitimate user should be protected).

We evaluated three storage strategies:

**A. Stateless (no server-side storage)**

Refresh tokens are pure JWTs verified by signature only. Revocation is
impossible without a blocklist. Logout is client-side only (delete the token
from storage). A stolen refresh token is valid until expiry.

Not acceptable: logout must actually invalidate sessions.

**B. Hash stored in the `users` table (`refreshTokenHash` column)**

A bcrypt hash of the current valid refresh token is stored directly on the
`UserEntity`. On each refresh, the incoming token is verified against the stored
hash. Mismatch (reuse attack) triggers immediate session invalidation.
Logout clears the hash.

One hash per user — one active session per user.

**C. Dedicated `refresh_tokens` table**

Each issued refresh token gets a row in a `refresh_tokens` table, keyed by
`(userId, tokenFamily)`. Supports multiple concurrent sessions (one per device).
Token rotation invalidates the entire family on reuse detection.

More complex; requires an additional table and more involved cleanup logic.

## Decision

Store a **bcrypt hash of the current refresh token in the `users` table**
(option B).

The rationale:

1. **Revocation works correctly.** Logout sets `refreshTokenHash = null`.
   The next refresh attempt fails immediately.

2. **Rotation attack detection is built in.** If an incoming refresh token does
   not match the stored hash, someone is reusing a previously rotated token.
   The response is to clear the hash entirely — forcing a full re-login and
   invalidating the attacker's copy too.

3. **Zero extra tables for the common case.** Most early-stage applications have
   one active session per user. Adding the complexity of a sessions table before
   it is needed is premature.

4. **Clear migration path.** The single-session model is not permanent — it is
   the right starting point. The `refreshTokenHash` field on `UserEntity` can be
   replaced with a `refresh_tokens` table without changing the public API or any
   callers of `AuthService`.

## Consequences

**Easier:**
- Logout is a single `UPDATE users SET refresh_token_hash = NULL WHERE id = ?`.
- Reuse detection requires no additional query — the hash is already loaded with
  the user record.
- No cleanup job needed for expired tokens (unlike a dedicated tokens table).

**Harder / trade-offs:**
- **Single session per user.** A user who logs in on a second device invalidates
  the first device's session on the next refresh cycle. For B2C products with
  multi-device users, this is a meaningful limitation.
- bcrypt hashing on every token refresh adds a small latency cost (~100ms).
  Acceptable for a refresh endpoint that is called infrequently.

**Future migration path:**
When multi-device sessions are required, introduce a `refresh_tokens` table:

```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  token_family UUID NOT NULL,    -- all tokens in a rotation chain share a family
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`AuthService.refreshTokens()` is the only method that needs to change.
The token rotation and reuse-detection logic transfers directly.
