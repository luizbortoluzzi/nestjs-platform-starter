import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Attaches a correlation ID to every request and mirrors it in the response.
 *
 * Behaviour:
 *  - If the caller supplies an X-Request-ID header (e.g. from a load balancer or
 *    API gateway), that value is re-used so the ID propagates end-to-end.
 *  - Otherwise a new UUID v4 is generated.
 *
 * Downstream code reads req.requestId (typed via src/@types/express/index.d.ts).
 * The ID is included in every log line and every API response body, so operators
 * can correlate client-reported errors with server-side logs without needing a
 * distributed tracing system.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string) || randomUUID();
    req.requestId = id;
    req.startTime = Date.now();
    res.setHeader('X-Request-ID', id);
    next();
  }
}
