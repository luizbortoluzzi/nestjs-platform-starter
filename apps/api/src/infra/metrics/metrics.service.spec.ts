import { register } from 'prom-client';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    // Clear the global prom-client registry before each test to avoid
    // "metric already registered" errors when the service is instantiated
    // multiple times across the test suite.
    register.clear();
    service = new MetricsService();
  });

  afterEach(() => register.clear());

  it('exposes an httpRequestsTotal Counter', () => {
    expect(service.httpRequestsTotal).toBeDefined();
  });

  it('exposes an httpRequestDuration Histogram', () => {
    expect(service.httpRequestDuration).toBeDefined();
  });

  it('getMetrics returns a non-empty Prometheus text exposition string', async () => {
    const metrics = await service.getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('contentType returns the prom-client registry content type', () => {
    expect(service.contentType).toContain('text/plain');
  });

  it('onApplicationBootstrap runs without throwing', () => {
    expect(() => service.onApplicationBootstrap()).not.toThrow();
  });
});
