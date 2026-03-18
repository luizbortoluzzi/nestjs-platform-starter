/**
 * End-to-end tests for the platform API.
 *
 * These tests require running infrastructure:
 *   make infra-up          # starts Postgres + Redis
 *   npm run migration:run  # creates tables (if not already done)
 *   npm run test:e2e       # run this suite
 *
 * Each test run uses a unique tag derived from Date.now() so test data never
 * collides between parallel runs. All test rows are cleaned up in afterAll.
 */

import { INestApplication } from '@nestjs/common';

import * as request from 'supertest';
import { DataSource } from 'typeorm';

import { createTestApp } from './helpers/create-test-app';

// Unique suffix — isolates data between concurrent test runs.
const RUN_TAG = Date.now().toString(36);
const email = (label: string) => `${label}-${RUN_TAG}@e2e-test.invalid`;

describe('Platform API (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
  });

  afterAll(async () => {
    // Cascade delete cleans up projects via the FK constraint.
    await db.query(`DELETE FROM users WHERE email LIKE $1`, [`%-${RUN_TAG}@e2e-test.invalid`]);
    await app.close();
  });

  // ─── Auth — registration ────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('201 — creates account and returns a token pair', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: email('reg-ok'), password: 'Password1!', name: 'Reg OK' })
        .expect(201);

      expect(res.body.data).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('409 — duplicate email returns Conflict', async () => {
      const dup = email('reg-dup');
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: dup, password: 'Password1!', name: 'Dup User' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: dup, password: 'Password1!', name: 'Dup User' })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
    });

    it('400 — invalid body returns validation error', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short', name: '' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });
  });

  // ─── Auth — login ───────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    const loginEmail = email('login');
    const loginPassword = 'Password1!';

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: loginEmail, password: loginPassword, name: 'Login User' });
    });

    it('200 — valid credentials return a token pair', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: loginEmail, password: loginPassword })
        .expect(200);

      expect(res.body.data).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('401 — wrong password returns Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: loginEmail, password: 'WrongPass1!' })
        .expect(401);
    });
  });

  // ─── Protected routes ───────────────────────────────────────────────────────

  describe('GET /api/v1/users/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: email('me'), password: 'Password1!', name: 'Me User' });
      accessToken = res.body.data.accessToken;
    });

    it('200 — returns authenticated user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        email: email('me'),
        name: 'Me User',
      });
      // Sensitive fields must never appear in the response
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.refreshTokenHash).toBeUndefined();
    });

    it('401 — missing token returns Unauthorized', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });

    it('401 — malformed token returns Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer this.is.not.a.jwt')
        .expect(401);
    });
  });

  // ─── Projects CRUD ──────────────────────────────────────────────────────────

  describe('Projects', () => {
    let accessToken: string;
    let otherAccessToken: string;
    let createdProjectId: string;

    beforeAll(async () => {
      const [ownerRes, otherRes] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({ email: email('proj-owner'), password: 'Password1!', name: 'Project Owner' }),
        request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({ email: email('proj-other'), password: 'Password1!', name: 'Other User' }),
      ]);
      accessToken = ownerRes.body.data.accessToken;
      otherAccessToken = otherRes.body.data.accessToken;
    });

    it('POST /api/v1/projects — 201 creates a project', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'E2E Test Project', description: 'Created by e2e suite' })
        .expect(201);

      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        name: 'E2E Test Project',
        status: 'active',
      });
      createdProjectId = res.body.data.id;
    });

    it("GET /api/v1/projects — 200 lists only the caller's projects", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((p: { id: string }) => p.id === createdProjectId)).toBe(true);
    });

    it('GET /api/v1/projects/:id — 200 returns the project for its owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(createdProjectId);
    });

    it('GET /api/v1/projects/:id — 403 when another user requests the project', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(403);
    });

    it('GET /api/v1/projects/:id — 404 for a non-existent project', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/projects/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('PATCH /api/v1/projects/:id — 200 updates project fields', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Renamed Project' })
        .expect(200);

      expect(res.body.data.name).toBe('Renamed Project');
    });

    it('DELETE /api/v1/projects/:id — 204 removes the project', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify it's gone
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // ─── Health endpoints ───────────────────────────────────────────────────────

  describe('Health', () => {
    it('GET /api/v1/health/live — 200', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
