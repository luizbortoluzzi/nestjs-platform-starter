import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

// PostgreSQL driver error codes surfaced via QueryFailedError.
const PG_UNIQUE_VIOLATION = '23505';
const PG_FK_VIOLATION = '23503';

interface ErrorShape {
  status: number;
  error: string;
  message: unknown;
}

/**
 * Global exception filter — catches every unhandled exception in the NestJS
 * pipeline and converts it to a consistent JSON error envelope:
 *
 *   {
 *     "statusCode": 400,
 *     "error":      "Bad Request",
 *     "message":    "...",          // string or string[] for validation errors
 *     "requestId":  "uuid",
 *     "timestamp":  "ISO-8601",
 *     "path":       "/api/v1/..."
 *   }
 *
 * Exception mapping:
 *   HttpException          → status from the exception, message/error extracted
 *   QueryFailedError 23505 → 409 Conflict (unique constraint)
 *   QueryFailedError 23503 → 409 Conflict (foreign key violation)
 *   QueryFailedError other → 500 (raw DB detail is never exposed)
 *   Anything else          → 500 with a generic safe message
 *
 * Logging:
 *   4xx → Logger.warn  (expected client errors, no stack needed)
 *   5xx → Logger.error (unexpected; full stack logged for post-mortems)
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.requestId ?? '-';
    const duration = request.startTime ? Date.now() - request.startTime : -1;
    const durationStr = duration >= 0 ? ` (${duration}ms)` : '';

    const { status, error, message } = this.classify(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}${durationStr} [${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${status}${durationStr} [${requestId}]`,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  // ─── Classification helpers ────────────────────────────────────────────────

  private classify(exception: unknown): ErrorShape {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof QueryFailedError) {
      return this.fromQueryFailedError(exception);
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  private fromHttpException(exception: HttpException): ErrorShape {
    const status = exception.getStatus();
    const res = exception.getResponse();

    if (typeof res === 'string') {
      return { status, error: HttpStatus[status], message: res };
    }

    const body = res as Record<string, unknown>;
    return {
      status,
      error: (body.error as string) ?? HttpStatus[status],
      message: body.message ?? exception.message,
    };
  }

  private fromQueryFailedError(exception: QueryFailedError): ErrorShape {
    const code = (exception as unknown as { code?: string }).code;

    switch (code) {
      case PG_UNIQUE_VIOLATION:
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'A record with the provided values already exists.',
        };
      case PG_FK_VIOLATION:
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'The operation conflicts with a related resource.',
        };
      default:
        // Never leak raw DB details — log the full error, return a safe message.
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Internal server error',
        };
    }
  }
}
