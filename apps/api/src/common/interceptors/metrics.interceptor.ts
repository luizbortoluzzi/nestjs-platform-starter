import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../../metrics/metrics.service';

/**
 * Records HTTP request metrics for every non-metrics route.
 *
 * Uses finalize() so the timer and counter are always updated,
 * regardless of whether the request succeeded or threw an error.
 *
 * Route normalisation: req.route?.path gives the Express route pattern
 * (e.g. /api/v1/users/:id) instead of the actual URL, preventing high
 * cardinality from per-user IDs in metric label values.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();

    // Skip the /metrics endpoint itself — self-referential metrics add noise.
    if (req.path.endsWith('/metrics')) {
      return next.handle();
    }

    const { method } = req;
    const endTimer = this.metricsService.httpRequestDuration.startTimer({ method });

    return next.handle().pipe(
      finalize(() => {
        const res = context.switchToHttp().getResponse<Response>();
        // req.route.path is the matched route pattern — avoids high cardinality
        // from real IDs in the URL (e.g. /users/:id instead of /users/abc-123).
        const route = req.route?.path ?? req.path;
        const statusCode = String(res.statusCode);
        endTimer({ route, status_code: statusCode });
        this.metricsService.httpRequestsTotal.inc({ method, route, status_code: statusCode });
      }),
    );
  }
}
