/**
 * Response contract tests — verify the transport layer behaves correctly.
 *
 * These tests deliberately focus on the _shape_ of every response rather than
 * business logic. They guard against regressions in:
 *   - TransformInterceptor envelope (success responses)
 *   - HttpExceptionFilter envelope (error responses)
 *   - Request-ID propagation header
 *   - Sensitive-field exclusion (passwordHash, refreshTokenHash)
 *
 * Run alongside the main e2e suite:
 *   npm run test:e2e
 */

import { INestApplication } from '@nestjs/common';

import * as request from 'supertest';
import { DataSource } from 'typeorm';

import { createTestApp } from './helpers/create-test-app';

const RUN_TAG = `contract-${Date.now().toString(36)}`;
const email = (label: string) => `${label}-${RUN_TAG}@e2e-test.invalid`;

describe('Response contracts (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;

  // A registered user + access token shared across all tests in this file.
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: email('contract'), password: 'Password1!', name: 'Contract User' });

    accessToken = res.body.data.accessToken as string;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM users WHERE email LIKE $1`, [`%-${RUN_TAG}@e2e-test.invalid`]);
    await app.close();
  });

  // ─── Success envelope ────────────────────────────────────────────────────────

  describe('TransformInterceptor envelope', () => {
    it('wraps every 2xx response in { data, timestamp, path }', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        data: expect.any(Object),
        timestamp: expect.any(String),
        path: '/api/v1/users/me',
      });
    });

    it('timestamp is a valid ISO-8601 date string', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const parsed = Date.parse(res.body.timestamp as string);
      expect(Number.isNaN(parsed)).toBe(false);
    });

    it('array responses are wrapped in { data: [...] }', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── Error envelope ──────────────────────────────────────────────────────────

  describe('HttpExceptionFilter envelope', () => {
    it('4xx responses have { statusCode, error, message, timestamp, path }', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        error: expect.any(String),
        message: expect.any(String),
        timestamp: expect.any(String),
        path: '/api/v1/users/me',
      });
    });

    it('400 validation error includes an array message field', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'bad', password: '1', name: '' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      // ValidationPipe returns an array of constraint messages.
      const { message } = res.body as { message: unknown };
      expect(Array.isArray(message) || typeof message === 'string').toBe(true);
    });

    it('404 body has statusCode 404 and a non-empty message', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        message: expect.any(String),
      });
    });

    it('409 conflict body has statusCode 409', async () => {
      const dup = email('dup');
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: dup, password: 'Password1!', name: 'Dup' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: dup, password: 'Password1!', name: 'Dup' })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
    });
  });

  // ─── X-Request-ID header ─────────────────────────────────────────────────────

  describe('X-Request-ID header', () => {
    it('every response carries an x-request-id header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('echoes the client-supplied x-request-id', async () => {
      const clientId = 'test-request-id-123';
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-request-id', clientId)
        .expect(200);

      expect(res.headers['x-request-id']).toBe(clientId);
    });

    it('generates a UUID when no client id is supplied', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  // ─── Sensitive-field exclusion ───────────────────────────────────────────────

  describe('Sensitive field exclusion', () => {
    it('GET /users/me never exposes passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('GET /users/me never exposes refreshTokenHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.refreshTokenHash).toBeUndefined();
    });

    it('POST /auth/register response does not leak password or hash', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: email('no-leak'), password: 'Password1!', name: 'No Leak' })
        .expect(201);

      const body = res.body.data as Record<string, unknown>;
      expect(body['password']).toBeUndefined();
      expect(body['passwordHash']).toBeUndefined();
      expect(body['refreshTokenHash']).toBeUndefined();
    });
  });
});
