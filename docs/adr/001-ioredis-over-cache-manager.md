# ADR-001: ioredis directly over cache-manager

**Status:** Accepted

## Context

The project requires Redis for two distinct concerns: application caching
(`AppCacheService`) and job queues (BullMQ). We needed to choose how to provide
the Redis client for caching.

The two candidate approaches were:

**A. `@nestjs/cache-manager` with a Redis store adapter**

NestJS ships a `CacheModule` built on top of the `cache-manager` library.
For Redis, it requires a separate store adapter package such as
`cache-manager-redis-yet` or `@tirke/node-cache-manager-ioredis`.

**B. `ioredis` directly**

Inject an ioredis client instance as a NestJS provider and build a thin
`AppCacheService` wrapper on top of it.

The complication with option A was that `cache-manager` underwent a major
breaking version change (v4 → v5) that changed its API and broke most store
adapters. At the time of this project's creation, version compatibility between
`cache-manager`, its Redis adapters, and `@nestjs/cache-manager` was unstable
and inconsistently documented. Multiple store packages on npm were unmaintained
or had open compatibility issues with the v5 API.

BullMQ — which we use for job queues — already depends on `ioredis` directly
and is well-maintained against it.

## Decision

Use `ioredis` directly. Provide it as a NestJS provider under the `REDIS_CLIENT`
injection token, exported globally from `AppCacheModule`. Build a typed
`AppCacheService` wrapper with the specific methods the application needs.

## Consequences

**Easier:**
- Single `ioredis` dependency for both cache and queue; no version matrix to
  manage between cache-manager, adapters, and ioredis.
- `AppCacheService` exposes only the methods we need (`get`, `set`, `del`,
  `exists`, `ttl`, `reset`) with typed signatures rather than a generic
  cache-manager interface.
- BullMQ and the cache service can share the same underlying library without
  conflicting version requirements.
- Retry strategy, connection events, and TTL defaults are explicit and
  centrally configured in `AppCacheModule`.

**Harder / trade-offs:**
- No out-of-the-box integration with NestJS's `@CacheKey` / `@CacheTTL`
  interceptor decorators — those require `CacheModule`. If route-level
  caching via decorators is needed later, it must be built manually or
  the cache layer must be replaced.
- `AppCacheService.reset()` calls `FLUSHDB`, which clears the entire Redis
  database. In a shared Redis instance, this would affect BullMQ queues.
  This is acceptable for local dev (the intended use case for `reset()`) but
  must never be called in production.

**Future migration path:**
If NestJS's cache-manager ecosystem stabilises and decorator-based caching
becomes valuable, `AppCacheService` can be reimplemented on top of
`@nestjs/cache-manager` without touching the rest of the codebase — all
callers depend on the `AppCacheService` interface, not on ioredis directly.
