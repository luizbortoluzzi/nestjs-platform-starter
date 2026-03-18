import { z } from 'zod';

/**
 * Zod schema for all environment variables consumed by this application.
 *
 * z.coerce.* coerces string values from process.env to the target type —
 * essential because environment variables are always strings at the OS level.
 *
 * The validated, coerced object is returned by validateEnv() and passed to
 * ConfigModule via the `validate` option, replacing the previous Joi approach.
 */
const envSchema = z.object({
  // ─── Application ──────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(6000),
  CORS_ORIGINS: z.string().default('http://localhost:6000'),

  // ─── Database ─────────────────────────────────────────────────────────────
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_SYNCHRONIZE: z.coerce.boolean().default(false),
  DATABASE_LOGGING: z.coerce.boolean().default(false),

  // ─── Redis ────────────────────────────────────────────────────────────────
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TTL: z.coerce.number().int().nonnegative().default(3600),

  // ─── JWT ──────────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates the raw process.env object at application startup.
 *
 * Called by ConfigModule's `validate` option — ConfigModule passes the full
 * environment as a plain object and expects a validated object in return.
 * Throwing here causes the application to exit before binding to any port,
 * which is the desired "fail fast" behaviour for misconfiguration.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const lines = result.error.issues.map((e) => `  ${e.path.join('.')}: ${e.message}`);
    throw new Error(`Environment validation failed:\n${lines.join('\n')}`);
  }

  return result.data;
}
