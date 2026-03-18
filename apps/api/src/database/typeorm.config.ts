import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Resolve .env relative to this file so the CLI works from any working directory,
// not just from apps/api/. Without an explicit path, dotenv.config() looks in
// process.cwd(), which changes depending on where the CLI is invoked.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Standalone DataSource used by the TypeORM CLI for migrations.
 * Run via: npm run migration:generate -- src/database/migrations/MigrationName
 *
 * process.env.X is string | undefined. TypeORM accepts string | undefined for
 * connection fields — it throws at runtime if any required value is missing,
 * which is acceptable here since this file is only used via the CLI.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '', 10) || 5432,
  database: process.env.DATABASE_NAME,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
