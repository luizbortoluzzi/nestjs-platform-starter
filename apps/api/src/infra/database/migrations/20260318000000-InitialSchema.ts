import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema migration — creates the users and projects tables.
 *
 * Run:   npm run migration:run
 * Revert: npm run migration:revert
 *
 * Notes:
 *  - uuid-ossp extension is created by infra/postgres/init.sql on first
 *    container start, so uuid_generate_v4() is always available.
 *  - In development, DATABASE_SYNCHRONIZE=true auto-creates tables — this
 *    migration is the production-safe equivalent.
 */
export class InitialSchema20260318000000 implements MigrationInterface {
  name = 'InitialSchema20260318000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Enum types ──────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM('user', 'admin')`);
    await queryRunner.query(`CREATE TYPE "projects_status_enum" AS ENUM('active', 'archived')`);

    // ─── Users ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                  UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "email"               VARCHAR(255)  NOT NULL,
        "password_hash"       TEXT          NOT NULL,
        "name"                VARCHAR(100)  NOT NULL,
        "role"                "users_role_enum" NOT NULL DEFAULT 'user',
        "is_active"           BOOLEAN       NOT NULL DEFAULT TRUE,
        "refresh_token_hash"  TEXT,
        "created_at"          TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users"       PRIMARY KEY ("id")
      )
    `);

    // ─── Projects ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id"          UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "name"        VARCHAR(200)  NOT NULL,
        "description" TEXT,
        "status"      "projects_status_enum" NOT NULL DEFAULT 'active',
        "owner_id"    UUID          NOT NULL,
        "created_at"  TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "projects"
        ADD CONSTRAINT "FK_projects_owner_id"
        FOREIGN KEY ("owner_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_owner_id"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "projects_status_enum"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}
