# nestjs-platform-starter

A production-oriented NestJS backend starter. PostgreSQL · Redis · JWT auth · BullMQ · Docker.

---

## Running locally

### Option A — Full stack in Docker (recommended)

All three services (API, Postgres, Redis) run in containers on an isolated network.

```bash
# 1. Copy the Docker env file — only needed once
cp infra/.env.example infra/.env

# 2. Build the API image and start all services
docker compose -f infra/docker-compose.yml up --build

# 3. Verify
curl http://localhost:3000/api/v1/health
```

The API waits for Postgres and Redis to pass their healthchecks before starting.
Subsequent starts (no code changes) skip the build:

```bash
docker compose -f infra/docker-compose.yml up
```

To stop and remove containers (volumes are preserved):

```bash
docker compose -f infra/docker-compose.yml down
```

To also wipe persistent volumes (full reset):

```bash
docker compose -f infra/docker-compose.yml down -v
```

---

### Option B — API on host, infrastructure in Docker

Run Postgres and Redis in Docker while the API runs directly on your machine
via `npm run start:dev`. Useful for fast iteration with hot-reload.

```bash
# 1. Start only the infrastructure services
docker compose -f infra/docker-compose.yml up postgres redis

# 2. Copy and configure the API env file
cp apps/api/.env.example apps/api/.env
# DATABASE_HOST and REDIS_HOST stay as 'localhost' — correct for host-based API

# 3. Install dependencies
cd apps/api && npm install

# 4. Start the API with hot-reload
npm run start:dev
```

---

## Bootstrapping notes

### Schema management

`DATABASE_SYNCHRONIZE=true` is enabled in `infra/.env.example` for local
convenience — TypeORM will create and update tables automatically.

**Never set this in production.** Use migrations instead:

```bash
# Generate a migration after changing an entity
npm run migration:generate -- src/database/migrations/CreateProjects

# Apply pending migrations
npm run migration:run
```

### First request

```bash
# Register a user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"password123","name":"Dev User"}'

# Login — returns { data: { accessToken, refreshToken } }
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"password123"}'

# Use the access token
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
```

### Health endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health` | Liveness — event loop is alive |
| `GET /api/v1/health/ready` | Readiness — DB, Redis, and memory are healthy |

---

## Project structure

```
apps/api/          NestJS application
  src/
    config/        Env validation and typed config service
    database/      TypeORM module, DataSource for CLI
    cache/         ioredis client and cache service
    queue/         BullMQ module and processors
    common/        Filters, interceptors, middleware, decorators
    modules/
      auth/        JWT + refresh token authentication
      users/       User entity and profile endpoints
      projects/    Example CRUD feature module
      health/      Liveness and readiness probes
infra/
  docker-compose.yml
  .env.example     Docker env template (service names as hosts)
  postgres/
    init.sql       Runs once on first DB initialisation
```
