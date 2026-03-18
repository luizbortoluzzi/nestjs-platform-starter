// process.env.X is typed as string | undefined by TypeScript, but Joi validates
// all required variables at startup and aborts if any are missing. The `as string`
// casts below are therefore safe — they assert what Joi already guarantees.
// Optional variables use `|| default` which coerces undefined to the default value.
export const configuration = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT ?? '', 10) || 6000,
    corsOrigins: process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:6000',
    ],
  },

  database: {
    host: process.env.DATABASE_HOST as string,
    port: parseInt(process.env.DATABASE_PORT ?? '', 10) || 5432,
    name: process.env.DATABASE_NAME as string,
    user: process.env.DATABASE_USER as string,
    password: process.env.DATABASE_PASSWORD as string,
    ssl: process.env.DATABASE_SSL === 'true',
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '', 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    ttl: parseInt(process.env.REDIS_TTL ?? '', 10) || 3600,
  },

  jwt: {
    secret: process.env.JWT_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
});

export type AppConfiguration = ReturnType<typeof configuration>;
