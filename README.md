# NestJS Platform Starter

A production-oriented NestJS backend starter built to demonstrate the foundations
a Platform Engineer puts in place before feature development begins.

**Stack:** NestJS · TypeScript · PostgreSQL · Redis · TypeORM · BullMQ · JWT · Docker · GitHub Actions

---

## What this starter includes

| Concern | Implementation |
|---|---|
| Configuration | Joi-validated env schema, typed `AppConfigService`, fail-fast on startup |
| Database | TypeORM with PostgreSQL, async setup, startup retry, migration CLI |
| Cache | ioredis directly (no cache-manager), typed `AppCacheService`, exponential backoff |
| Queue | BullMQ with two named queues, processor pattern, separate Redis connection |
| Authentication | JWT access tokens (15m) + refresh tokens (7d, rotation, reuse detection) |
| Authorization | Global `JwtAuthGuard`, `@Public()` opt-out decorator |
| Validation | `ValidationPipe` with whitelist, forbid unknown, transform, stop-at-first-error |
| Error handling | Global `@Catch()` filter, TypeORM constraint mapping (23505 → 409), safe 500s |
| Logging | Request correlation ID, unified access log format across success and error paths |
| Health | Liveness probe (event loop), readiness probe (DB + Redis + heap) |
| Docker | Multi-stage Dockerfile, non-root user, full Compose stack with healthcheck-gated startup |
| CI | GitHub Actions — lint, test, build, Docker validation in parallel |

---

## Quick start

### Option A — Full stack in Docker

```bash
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.yml up --build
curl http://localhost:6000/api/v1/health
```

Or with Make:

```bash
cp infra/.env.example infra/.env
make up-build
```

### Option B — API on host, infrastructure in Docker

Best for fast iteration with hot-reload.

```bash
# Start Postgres and Redis
make infra-up

# First time only
cp apps/api/.env.example apps/api/.env
cd apps/api && npm install

# Hot-reload dev server
npm run start:dev
```

Or in one command after first-time setup:

```bash
make dev
```

### First request

```bash
# Register
curl -X POST http://localhost:6000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"password123","name":"Dev"}'

# Login — response: { data: { accessToken, refreshToken }, statusCode, requestId, timestamp }
curl -X POST http://localhost:6000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"password123"}'

# Authenticated request
curl http://localhost:6000/api/v1/projects \
  -H "Authorization: Bearer <accessToken>"
```

---

## API endpoints

### Auth (`/api/v1/auth`) — public

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Create account, returns token pair |
| `POST` | `/auth/login` | Authenticate, returns token pair |
| `POST` | `/auth/logout` | Invalidate refresh token (requires access token) |
| `POST` | `/auth/refresh` | Rotate token pair (send refresh token as Bearer) |

### Users (`/api/v1/users`) — requires JWT

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users/me` | Get own profile |
| `PATCH` | `/users/me` | Update own profile |

### Projects (`/api/v1/projects`) — requires JWT

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects` | Create project (201) |
| `GET` | `/projects` | List own projects |
| `GET` | `/projects/:id` | Get one (404 / 403 if not owner) |
| `PATCH` | `/projects/:id` | Partial update (403 if not owner) |
| `DELETE` | `/projects/:id` | Delete (204, 403 if not owner) |

### Health (`/api/v1/health`) — public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness — event loop responding |
| `GET` | `/health/ready` | Readiness — DB + Redis + heap healthy |

---

## Project layout

```
.
├── apps/
│   └── api/                   NestJS application
│       ├── src/
│       │   ├── @types/        Express type augmentations (requestId, startTime)
│       │   ├── config/        Env validation (Joi), typed AppConfigService
│       │   ├── database/      TypeORM module, DataSource for migration CLI
│       │   ├── cache/         ioredis provider (REDIS_CLIENT), AppCacheService
│       │   ├── queue/         BullMQ root + named queues + processor pattern
│       │   ├── common/
│       │   │   ├── decorators/   @Public(), @CurrentUser()
│       │   │   ├── filters/      HttpExceptionFilter (global, @Catch())
│       │   │   ├── interceptors/ LoggingInterceptor, TransformInterceptor
│       │   │   └── middleware/   RequestIdMiddleware
│       │   └── modules/
│       │       ├── auth/         JWT strategies, guards, full auth flow
│       │       ├── users/        UserEntity, profile endpoints
│       │       ├── projects/     Example CRUD module (reference implementation)
│       │       └── health/       Liveness + readiness probes
│       ├── Dockerfile            Multi-stage production build
│       ├── .env.example          Local dev env template (DATABASE_HOST=localhost)
│       └── eslint.config.js      ESLint v9 flat config
├── infra/
│   ├── docker-compose.yml     Full local stack (api + postgres + redis)
│   ├── .env.example           Docker env template (DATABASE_HOST=postgres)
│   └── postgres/
│       └── init.sql           First-run DB initialisation (uuid-ossp)
├── docs/
│   ├── architecture.md        Request lifecycle, module map, auth flow
│   ├── new-module.md          Step-by-step guide for adding a feature module
│   └── adr/                   Architectural Decision Records
├── .github/
│   └── workflows/
│       └── ci.yml             Lint · Test · Build · Docker validation
└── Makefile                   Developer convenience commands
```

---

## Configuration

All environment variables are validated at startup by Joi. The application
exits immediately if any required variable is missing or invalid.

Copy the appropriate template before running:

| Template | Use when |
|---|---|
| `apps/api/.env.example` | Running the API directly on your host |
| `infra/.env.example` | Running the full stack with Docker Compose |

### Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `6000` | HTTP port |
| `CORS_ORIGINS` | `http://localhost:6000` | Comma-separated allowed origins |
| `DATABASE_HOST` | — | Postgres host (`localhost` or `postgres` in Docker) |
| `DATABASE_PORT` | `5432` | Postgres port |
| `DATABASE_NAME` | — | Database name |
| `DATABASE_USER` | — | Database user |
| `DATABASE_PASSWORD` | — | Database password |
| `DATABASE_SSL` | `false` | Enable TLS for Postgres connection |
| `DATABASE_SYNCHRONIZE` | `false` | Auto-sync schema — **never true in production** |
| `DATABASE_LOGGING` | `false` | Log SQL queries |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password (optional) |
| `REDIS_TTL` | `3600` | Default cache TTL in seconds |
| `JWT_SECRET` | — | Access token signing secret |
| `JWT_REFRESH_SECRET` | — | Refresh token signing secret (must differ from JWT_SECRET) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |

---

## Schema management

`DATABASE_SYNCHRONIZE=true` is set in `infra/.env.example` for local
convenience only. TypeORM will create and update tables automatically.

**Never use in production. Use migrations:**

```bash
# After modifying an entity
cd apps/api && npm run migration:generate -- src/database/migrations/DescribeMigration

# Apply pending
npm run migration:run

# Roll back one
npm run migration:revert
```

---

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full picture:
request lifecycle, module dependency map, and authentication flow.

See [docs/adr/](docs/adr/) for the decisions behind key implementation choices.

---

## Adding a new module

The `projects` module is the reference implementation. See
[docs/new-module.md](docs/new-module.md) for a concrete step-by-step walkthrough.

---

## CI

Every push and pull request to `main`/`develop` runs four jobs in parallel:

```
lint ──┐
test ──┼──(all pass)──▶ docker-build
build ─┘
```

- **lint** — ESLint, fails on error-level rules
- **test** — Jest unit tests (`--passWithNoTests` until the suite is built out)
- **build** — TypeScript compilation via `nest build`
- **docker-build** — validates the full multi-stage Dockerfile end-to-end

---

## Roadmap

Natural next steps on top of this foundation:

- **TypeORM migrations baseline** — generate the initial migration from current entities
- **Unit test suite** — service-layer tests with mocked repositories
- **Swagger / OpenAPI** — `@nestjs/swagger` with decorators on existing DTOs
- **Pagination** — `page` / `limit` query params on list endpoints
- **Role-based access control** — `RolesGuard` + `@Roles()` decorator
- **Rate limiting** — `@nestjs/throttler` as a second `APP_GUARD`
- **Multi-device sessions** — dedicated `refresh_tokens` table keyed by `(userId, tokenFamily)`
- **Deploy workflow** — `deploy.yml` triggered on `main` push, pushes to a container registry
