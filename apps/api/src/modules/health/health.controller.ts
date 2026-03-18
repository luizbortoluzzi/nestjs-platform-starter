import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { RedisHealthIndicator } from './indicators/redis.health';

// Maximum heap the process may use before the readiness probe fails.
// Adjust this threshold to match the memory limits of your deployment target.
const HEAP_LIMIT_BYTES = 512 * 1024 * 1024; // 512 MB

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  /**
   * Liveness probe — answers: "Is the process alive?"
   * Intentionally lightweight: only confirms the Node.js event loop is
   * responding. No dependency checks. Used by Docker HEALTHCHECK and
   * Kubernetes liveness probes.
   */
  @Get()
  @Public()
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  /**
   * Readiness probe — answers: "Can this instance safely serve traffic?"
   * Checks all required runtime dependencies. Used by load balancers and
   * Kubernetes readiness probes to gate request routing.
   *
   * Fails (503) if any of the following are true:
   *  - PostgreSQL is unreachable
   *  - Redis is unreachable
   *  - Process heap exceeds HEAP_LIMIT_BYTES
   */
  @Get('ready')
  @Public()
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES),
    ]);
  }
}
