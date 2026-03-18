import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnApplicationBootstrap {
  /**
   * Dedicated registry — avoids the prom-client global singleton which throws
   * "metric already registered" when NestJS re-instantiates the service (e.g.
   * during hot-reload or in unit tests that run multiple suite files).
   */
  private readonly registry: Registry;

  /**
   * Total HTTP request counter.
   * Labels: method (GET/POST/…), route (/api/v1/users/:id), status_code (200/404/…)
   */
  readonly httpRequestsTotal: Counter<string>;

  /**
   * HTTP request duration histogram.
   * Buckets tuned for typical web service latencies (5ms – 5s).
   */
  readonly httpRequestDuration: Histogram<string>;

  constructor() {
    this.registry = new Registry();

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests by method, route, and status code',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      // From 5ms to 5s — covers fast cache hits through slow DB queries.
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
  }

  onApplicationBootstrap(): void {
    // Collect Node.js process metrics: CPU, memory, event loop lag, GC, open
    // file descriptors, etc. These appear as process_* and nodejs_* gauges.
    collectDefaultMetrics({ register: this.registry });
  }

  /** Returns the full Prometheus text exposition format. */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type header value expected by Prometheus scrapers. */
  get contentType(): string {
    return this.registry.contentType;
  }
}
