import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs every successful HTTP response (2xx / 3xx).
 *
 * Error responses (4xx / 5xx) are logged by HttpExceptionFilter instead,
 * so together they produce a complete access log with no duplication.
 *
 * Log format (mirrors the filter's format):
 *   GET /api/v1/projects → 200 (42ms) [<requestId>]
 *
 * The requestId is set by RequestIdMiddleware and is also present in the
 * response body and X-Request-ID header, allowing end-to-end correlation.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, requestId, startTime } = request;

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const duration = startTime ? Date.now() - startTime : -1;
        const durationStr = duration >= 0 ? ` (${duration}ms)` : '';
        this.logger.log(
          `${method} ${url} → ${response.statusCode}${durationStr} [${requestId ?? '-'}]`,
        );
      }),
    );
  }
}
