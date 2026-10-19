import * as request from 'supertest';
import {
  bearer,
  createCategoryFixture,
  createGameFixture,
  createTestApp,
  createUser,
  login,
  resetDb,
  TestCtx,
} from './helpers';

describe('Regra de pontuação do campeonato (e2e)', () => {
  let ctx: TestCtx;
  let tOrg: string;
  const http = () => request(ctx.app.getHttpServer());
  const create = (body: Record<string, unknown>) =>
    http().post('/events').set(bearer(tOrg)).send({ code: 'SC1', name: 'Scoring', ...body });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER' });
    tOrg = await login(ctx.app, 'org@t.com');
  });

  it('rank_sum: resposta traz scoring.mode e isLowestPointsBetter true', async () => {
    const res = await create({ scoringMode: 'rank_sum' }).expect(201);
    expect(res.body.scoring.mode).toBe('rank_sum');
    expect(res.body.isLowestPointsBetter).toBe(true);
  });

  it('modo inventado => 400', async () => {
    await create({ scoringMode: 'inventado' }).expect(400);
  });

  it('pointsTable vazia ou com negativo => 400', async () => {
    await create({ pointsTable: [] }).expect(400);
    await create({ pointsTable: [-5] }).expect(400);
  });

  it('tiebreak split:Wall Balls aceito; xyz => 400', async () => {
    const ok = await create({ tiebreak: 'split:Wall Balls' }).expect(201);
    expect(ok.body.scoring.tiebreak).toBe('split:Wall Balls');
    await create({ code: 'SC2', tiebreak: 'xyz' }).expect(400);
  });

  it('hyrox sem campos de regra => scoring.mode total_time', async () => {
    const res = await create({ eventType: 'hyrox' }).expect(201);
    expect(res.body.scoring.mode).toBe('total_time');
  });

  it('PUT trocando para points_table zera isLowestPointsBetter e devolve scoring', async () => {
    await create({ scoringMode: 'rank_sum' }).expect(201);
    const res = await http()
      .put('/events/SC1')
      .set(bearer(tOrg))
      .send({ scoringMode: 'points_table' })
      .expect(200);
    expect(res.body.isLowestPointsBetter).toBe(false);
    expect(res.body.scoring.mode).toBe('points_table');
  });

  describe('parciais em POST /scores', () => {
    const score = { idEvent: 1, game: 'G1', category: 1, codeTeam: 101, time: '05:00', judge: 'Juiz' };

    beforeEach(async () => {
      const org = await ctx.prisma.user.findFirst({ where: { email: 'org@t.com' } });
      await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [org.id] });
      await createCategoryFixture(ctx.prisma, 'G1');
      await ctx.prisma.registration.create({
        data: { code: 101, categoryId: 1, gameCode: 'G1', team: 'Time A' },
      });
      await ctx.prisma.workout.create({
        data: { code: 1, game: 'G1', category: 1, title: 'WOD 1', type: 'for_time' },
      });
    });

    it('grava e devolve os parciais', async () => {
      const splits = [
        { name: 'Corrida 1', seconds: 240 },
        { name: 'SkiErg', seconds: 230.5 },
      ];
      const res = await http().post('/scores').set(bearer(tOrg)).send({ ...score, splits }).expect(201);
      expect(res.body.score.splits).toEqual(splits);
    });

    it('splits mal formado => 400', async () => {
      await http().post('/scores').set(bearer(tOrg)).send({ ...score, splits: 'x' }).expect(400);
      await http()
        .post('/scores')
        .set(bearer(tOrg))
        .send({ ...score, splits: [{ name: '', seconds: 10 }] })
        .expect(400);
      await http()
        .post('/scores')
        .set(bearer(tOrg))
        .send({ ...score, splits: [{ name: 'A', seconds: -1 }] })
        .expect(400);
    });
  });
});
