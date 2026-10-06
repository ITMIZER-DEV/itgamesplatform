import * as request from 'supertest';
import { createTestApp, resetDb, TestCtx } from './helpers';

describe('Smoke (e2e)', () => {
  let ctx: TestCtx;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  it('GET /events responde 200 com lista vazia', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/events').expect(200);
    expect(res.body).toEqual([]);
  });
});
