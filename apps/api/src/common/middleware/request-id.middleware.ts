import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Exposes the request correlation ID as req.requestId for use in filters,
 * interceptors, and service-layer code.
 *
 * nestjs-pino (pino-http) registers its middleware before NestJS middleware
 * and assigns req.id via genReqId (see AppLoggerModule). That genReqId already
 * handles X-Request-ID forwarding and sets the response header. This middleware
 * mirrors req.id → req.requestId so existing code reading req.requestId works
 * unchanged, with a safe fallback if pino-http is absent.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // pino-http sets req.id before NestJS middleware runs.
    const pinoId = (req as unknown as { id?: unknown }).id;
    req.requestId =
      typeof pinoId === 'string' && pinoId
        ? pinoId
        : (req.headers['x-request-id'] as string) || randomUUID();
    req.startTime = Date.now();
    next();
  }
}
