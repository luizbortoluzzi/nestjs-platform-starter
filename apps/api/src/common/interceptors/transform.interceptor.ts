import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  statusCode: number;
  requestId: string;
  timestamp: string;
}

/**
 * Wraps every successful response in a consistent envelope so clients always
 * receive the same top-level shape regardless of the endpoint:
 *
 *   {
 *     "data":       <controller return value>,
 *     "statusCode": 200,
 *     "requestId":  "uuid",   // correlates with X-Request-ID header and server logs
 *     "timestamp":  "ISO-8601"
 *   }
 *
 * Error responses are shaped by HttpExceptionFilter instead, which uses a
 * parallel structure (statusCode / error / message / requestId / timestamp / path).
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => ({
        data,
        statusCode: response.statusCode,
        requestId: request.requestId ?? '-',
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
