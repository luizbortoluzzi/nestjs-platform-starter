import { Global, Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../../config/config.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const db = configService.getDatabaseConfig();
        const logger = new Logger('TypeORM');

        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          database: db.name,
          username: db.user,
          password: db.password,
          // WARNING: rejectUnauthorized: false disables TLS certificate
          // verification. This is acceptable for managed cloud databases that
          // use self-signed certs, but MUST be reviewed before production.
          // Set DATABASE_SSL=false if your provider supports full cert
          // verification, and remove this flag after validating the cert chain.
          ssl: db.ssl ? { rejectUnauthorized: false } : false,
          synchronize: db.synchronize,

          // In development, DATABASE_LOGGING=true enables full query logging.
          // In all environments, errors and warnings are always surfaced.
          logging: db.logging
            ? ['query', 'schema', 'migration', 'error', 'warn']
            : ['error', 'warn'],

          entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: false,

          // Retry the initial connection — handles the common Docker race
          // condition where the API container starts before postgres is ready.
          retryAttempts: 5,
          retryDelay: 3000,

          extra: {
            // Fail fast if the connection cannot be established at all.
            connectionTimeoutMillis: 10_000,
          },

          logger: {
            log: (level: string, message: string) => {
              if (level === 'warn') logger.warn(message);
            },
            logQuery: (query: string) => {
              if (db.logging) logger.verbose(query);
            },
            logQueryError: (error: string, query: string) => {
              logger.error(`Query failed: ${error} | ${query}`);
            },
            logQuerySlow: (time: number, query: string) => {
              logger.warn(`Slow query (${time}ms): ${query}`);
            },
            logSchemaBuild: (message: string) => {
              logger.log(message);
            },
            logMigration: (message: string) => {
              logger.log(message);
            },
          },
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
