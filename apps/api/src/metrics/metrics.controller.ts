import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

/**
 * Exposes Prometheus metrics at GET /api/v1/metrics.
 *
 * Marked @Public() — Prometheus scrapers do not carry JWT tokens.
 * In production, restrict scrape access at the network/ingress layer
 * rather than at the application layer.
 *
 * Uses @Res() to bypass the TransformInterceptor — Prometheus expects
 * raw text, not the standard { data, statusCode, timestamp } envelope.
 */
// Prometheus scrapes this endpoint every scrape_interval (default 15s).
// Skip rate limiting so the scraper never trips the throttler.
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metricsService.contentType);
    res.send(await this.metricsService.getMetrics());
  }
}
