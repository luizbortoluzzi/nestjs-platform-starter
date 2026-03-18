# Architecture

## System topology

```
                        ┌──────────────────────────────────────────────┐
                        │  Docker network: platform                     │
                        │                                               │
  Browser / Client ────▶│  api:6000 ──▶ postgres:5432                  │
                        │           └──▶ redis:6379                     │
                        │                                               │
                        └──────────────────────────────────────────────┘
```

All three services share the `platform` Docker network. The API communicates with
Postgres and Redis by service name. The API's port (6000) is the only port
exposed to the host machine.

---

## Request lifecycle

Every HTTP request passes through the following NestJS layers in order:

```
Incoming request
      │
      ▼
RequestIdMiddleware        ← attaches req.requestId (UUID) and req.startTime
      │
      ▼
JwtAuthGuard (global)      ← validates Bearer token; skips routes marked @Public()
      │
      ▼
ValidationPipe (global)    ← strips unknown fields, coerces types, validates DTOs
      │
      ▼
Controller method
      │
      ▼
ClassSerializerInterceptor ← strips @Exclude() fields (e.g. passwordHash)
      │
      ▼
TransformInterceptor       ← wraps response: { data, statusCode, requestId, timestamp }
      │
      ▼
LoggingInterceptor         ← logs: METHOD /path → 200 (42ms) [requestId]
      │
      ▼
Response to client
```

**On error**, the exception bypasses the interceptor chain and goes directly to:

```
HttpExceptionFilter (@Catch())
      │
      ├── HttpException     → extract status + message
      ├── QueryFailedError  → map PG codes (23505 → 409, 23503 → 409)
      └── Unknown           → 500, log full stack
      │
      ▼
{ statusCode, error, message, requestId, timestamp, path }
```

The filter logs 4xx as `warn` and 5xx as `error`. Together with the
`LoggingInterceptor`, every request produces exactly one log line with a
consistent format:

```
GET  /api/v1/projects       → 200 (42ms)  [3f2a1b...]   ← LoggingInterceptor
POST /api/v1/auth/register  → 409 (8ms)   [7c1b4d...]   ← HttpExceptionFilter
GET  /api/v1/projects/bad   → 500 (3ms)   [9d4e2c...]   ← HttpExceptionFilter + stack
```

---

## Module dependency map

```
AppModule
├── AppConfigModule (global)      ← must be first; all modules depend on it
├── DatabaseModule (global)       ← TypeORM, shares AppConfigService
├── AppCacheModule (global)       ← ioredis, exports REDIS_CLIENT token
├── QueueModule                   ← BullMQ, own Redis connection
│
├── UsersModule                   ← UserEntity, UsersService
│   └── exports: UsersService
│
├── AuthModule
│   ├── imports: UsersModule, PassportModule, JwtModule
│   └── exports: AuthService, JwtAuthGuard
│       (JwtAuthGuard is also registered as APP_GUARD in AppModule)
│
├── ProjectsModule                ← ProjectEntity, ProjectsService
│   └── exports: ProjectsService
│
└── HealthModule                  ← terminus, liveness + readiness probes
    └── provides: RedisHealthIndicator (uses REDIS_CLIENT)
```

**Infrastructure modules are global** (`isGlobal: true`), so their providers
(`AppConfigService`, `REDIS_CLIENT`, TypeORM repository factory) are available
everywhere without explicit imports.

**Feature modules are not global** and must be imported by any module that
needs their services.

---

## Authentication flow

### Login

```
POST /auth/login
      │
      ▼
LocalAuthGuard → LocalStrategy.validate()
      │             └── UsersService.findByEmail()
      │             └── bcrypt.compare(password, hash)
      │             └── returns UserEntity on success
      ▼
AuthController.login(user: UserEntity)
      │
      ▼
AuthService.issueTokenPair(user)
      ├── signAccessToken()  → JWT { sub, email, role }, expires 15m
      ├── signRefreshToken() → JWT { sub }, expires 7d (different secret)
      └── bcrypt.hash(refreshToken, 10) → stored as user.refreshTokenHash
      │
      ▼
{ accessToken, refreshToken }
```

### Authenticated request

```
Authorization: Bearer <accessToken>
      │
      ▼
JwtAuthGuard → JwtStrategy.validate()
      │             └── verify signature with JWT_SECRET
      │             └── return { id, email, role } → req.user
      ▼
@CurrentUser() extracts req.user
```

### Token refresh

```
POST /auth/refresh
Authorization: Bearer <refreshToken>
      │
      ▼
JwtRefreshGuard → JwtRefreshStrategy.validate()
      │             └── verify signature with JWT_REFRESH_SECRET
      │             └── extract raw token + userId
      │             └── return { userId, refreshToken } → req.user
      ▼
AuthService.refreshTokens(userId, incomingToken)
      ├── load user.refreshTokenHash from DB
      ├── bcrypt.compare(incomingToken, stored hash)
      │       └── MISMATCH → clear hash (rotation attack) → throw 401
      ├── signAccessToken()
      ├── signRefreshToken()
      └── store new hash → invalidates previous refresh token
      │
      ▼
{ accessToken, refreshToken }
```

The single refresh token per user model means logging out on one device
invalidates all sessions. For multi-device support, replace `refreshTokenHash`
on `UserEntity` with a dedicated `refresh_tokens` table (see
[ADR-002](adr/002-refresh-token-storage.md)).

---

## Infrastructure decisions

| Decision | Choice | Rationale |
|---|---|---|
| Cache client | ioredis directly | Avoids cache-manager v5 compatibility issues; BullMQ shares the same dep |
| Queue | BullMQ separate Redis connection | Prevents queue traffic from blocking cache operations |
| Auth guard | Global APP_GUARD + @Public() | Secure by default; opt-out is explicit and auditable |
| Refresh tokens | Hashed in users table | Simple; provides revocation without extra tables |
| Schema sync | false by default | Forces intentional migrations in all environments |
| Error shape | Flat envelope + requestId | Consistent for clients; request ID enables log correlation |

See [adr/](adr/) for full context on the significant decisions.
