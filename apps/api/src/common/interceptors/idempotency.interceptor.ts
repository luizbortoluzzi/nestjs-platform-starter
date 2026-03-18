import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { Request, Response } from 'express';
import { Observable, from, switchMap } from 'rxjs';

import { AppCacheService } from '../../infra/cache/cache.service';

/**
 * Idempotency interceptor — prevents duplicate mutations caused by retried
 * requests.
 *
 * Usage: apply @UseInterceptors(IdempotencyInterceptor) to any POST/PATCH
 * handler where duplicate execution would be harmful (e.g. registration,
 * payment, project creation).
 *
 * Contract:
 *  1. Client sends `Idempotency-Key: <uuid>` header with the first request.
 *  2. On first call the key is claimed atomically (Redis SET NX). The response
 *     body is stored against the key and returned normally.
 *  3. On any subsequent call with the same key the stored response is returned
 *     immediately with HTTP 200 — the handler is NOT invoked again.
 *  4. If the first call is still in-flight (key claimed, no result yet) the
 *     server returns 409 Conflict so the client backs off and retries.
 *
 * Key TTL: 24 hours (configurable via IDEMPOTENCY_TTL_SECONDS).
 */

const LOCK_SENTINEL = '__PROCESSING__';
const LOCK_TTL_SECONDS = 30; // max time a request may be in-flight
const RESULT_TTL_SECONDS = 86_400; // 24 h — how long to honour the key

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly cache: AppCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const idempotencyKey = req.headers['idempotency-key'];

    // Not all callers supply a key — pass through transparently.
    if (!idempotencyKey) {
      return next.handle();
    }

    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      throw new BadRequestException('Idempotency-Key header must be a non-empty string.');
    }

    const redisKey = `idempotency:${idempotencyKey}`;

    // Wrap the async pre-check in an observable so NestJS can track it.
    return from(this.claimOrReplay(redisKey, res)).pipe(
      switchMap((cachedResult) => {
        // Key already had a completed result — return it, skip the handler.
        if (cachedResult !== null) {
          return from(Promise.resolve(cachedResult));
        }

        // Key was just claimed — execute the handler, then persist the result.
        return next
          .handle()
          .pipe(
            switchMap((result: unknown) =>
              from(this.cache.set(redisKey, result, RESULT_TTL_SECONDS)).pipe(
                switchMap(() => from(Promise.resolve(result))),
              ),
            ),
          );
      }),
    );
  }

  /**
   * Attempts to claim the key or retrieve a previously stored result.
   *
   * Returns:
   *  - `null`  → key was successfully claimed; caller should run the handler
   *  - `value` → key already has a completed result; replay it
   *
   * Throws ConflictException if the key is currently being processed.
   */
  private async claimOrReplay(redisKey: string, res: Response): Promise<unknown> {
    // Check for an existing completed result first (fast path).
    const existing = await this.cache.get<unknown>(redisKey);

    if (existing !== null) {
      if (existing === LOCK_SENTINEL) {
        // First request still in-flight — tell client to retry.
        throw new ConflictException(
          'A request with this Idempotency-Key is already being processed. Retry after a moment.',
        );
      }
      // Replay the stored response.
      res.setHeader('Idempotency-Replayed', 'true');
      return existing;
    }

    // Key is unclaimed — atomically set the processing lock.
    const claimed = await this.cache.setIfNotExists(redisKey, LOCK_SENTINEL, LOCK_TTL_SECONDS);

    if (!claimed) {
      // Lost the race — another instance claimed the lock between our get and set.
      throw new ConflictException(
        'A request with this Idempotency-Key is already being processed. Retry after a moment.',
      );
    }

    return null;
  }
}
