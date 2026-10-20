import * as request from 'supertest';
import { bearer, createCategoryFixture, createGameFixture, createTestApp, createUser, login, resetDb, TestCtx } from './helpers';

describe('Trava de súmula após o cálculo oficial (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let tA: string;
  let tSuper: string;
  let tJudge: string;
  const http = () => request(ctx.app.getHttpServer());
  const base = '/official/G1/categories/1/events/1';
  const body = (over: Record<string, unknown> = {}) => ({
    game: 'G1',
    category: 1,
    idEvent: 1,
    codeTeam: 101,
    time: '05:30',
    judge: 'Juiz',
    auditReason: 'teste',
    ...over,
  });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER', name: 'Org A' });
    await createUser(ctx.prisma, { email: 'su@t.com', role: 'SUPER_ADMIN', name: 'Super' });
    await createUser(ctx.prisma, { email: 'j@t.com', role: 'JUDGE' });
    tA = await login(ctx.app, 'a@t.com');
    tSuper = await login(ctx.app, 'su@t.com');
    tJudge = await login(ctx.app, 'j@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'G1', 1);
    await createCategoryFixture(ctx.prisma, 'G1', 2);
    for (const wod of [1, 2]) {
      await ctx.prisma.workout.create({
        data: { code: wod, game: 'G1', category: 1, title: `WOD ${wod}`, type: 'for_time', timeCap: '10:00' },
      });
      await ctx.prisma.event.create({ data: { idEvent: wod, game: 'G1', category: 1, title: `WOD ${wod}`, workout: wod } });
    }
    for (const code of [101, 102]) {
      await ctx.prisma.registration.create({
        data: { code, categoryId: 1, gameCode: 'G1', team: `Time ${code}`, status: 'paid', number: `#${code}` },
      });
    }
    await ctx.prisma.registration.create({
      data: { code: 201, categoryId: 2, gameCode: 'G1', team: 'Time 201', status: 'paid', number: '#201' },
    });
    const s = { game: 'G1', category: 1, idEvent: 1, judge: 'Juiz', scoreStatus: 'approved_by_head_judge' };
    await ctx.prisma.score.create({ data: { ...s, codeTeam: 101, time: '05:00' } });
    await ctx.prisma.score.create({ data: { ...s, codeTeam: 102, time: '06:00' } });
    await ctx.prisma.heat.create({
      data: { gameCode: 'G1', categoryId: 1, workoutCode: 1, heatNumber: 1, startTime: '09:00', status: 'completed' },
    });
  });

  const confirm = () => http().post(`${base}/confirm`).set(bearer(tA)).expect(200);

  describe('POST /scores', () => {
    it('JUDGE, ORGANIZER e SUPER_ADMIN recebem 409 no par confirmado', async () => {
      await confirm();
      for (const t of [tJudge, tA, tSuper]) {
        const res = await http().post('/scores').set(bearer(t)).send(body()).expect(409);
        expect(res.body.message).toContain('já foi calculado oficialmente');
      }
      const sc = await ctx.prisma.score.findFirstOrThrow({ where: { codeTeam: 101, idEvent: 1 } });
      expect(sc.time).toBe('05:00');
    });

    it('outro WOD e outra categoria seguem liberados', async () => {
      await confirm();
      await http().post('/scores').set(bearer(tJudge)).send(body({ idEvent: 2 })).expect(201);
      await http()
        .post('/scores')
        .set(bearer(tJudge))
        .send(body({ category: 2, codeTeam: 201 }))
        .expect(201);
    });

    it('categoria diferente no corpo não burla a trava (súmula existente / inscrição da equipe)', async () => {
      await confirm();
      await http().post('/scores').set(bearer(tJudge)).send(body({ category: 2 })).expect(409);
    });

    it('foto da súmula continua permitida com o WOD confirmado', async () => {
      await confirm();
      const sc = await ctx.prisma.score.findFirstOrThrow({ where: { codeTeam: 101, idEvent: 1 } });
      await http().patch(`/scores/${sc.code}/photo`).set(bearer(tJudge)).send({ photo: 'http://x/y.png' }).expect(200);
    });

    it('depois de reverter, o lançamento volta a funcionar', async () => {
      await confirm();
      await http().post('/scores').set(bearer(tJudge)).send(body()).expect(409);
      await http().post(`${base}/revert`).set(bearer(tA)).send({ reason: 'motivo válido' }).expect(200);
      await http().post('/scores').set(bearer(tJudge)).send(body()).expect(201);
    });
  });

  describe('cancelar inscrição', () => {
    it('equipe com súmula no WOD confirmado: 409 e nada muda', async () => {
      await confirm();
      await http()
        .patch('/events/G1/registrations/101/status')
        .set(bearer(tA))
        .send({ status: 'cancelled' })
        .expect(409);
      const reg = await ctx.prisma.registration.findUniqueOrThrow({ where: { code_gameCode: { code: 101, gameCode: 'G1' } } });
      expect(reg.status).toBe('paid');
      const sc = await ctx.prisma.score.findFirstOrThrow({ where: { codeTeam: 101, idEvent: 1 } });
      expect(sc.scoreStatus).toBe('approved_by_head_judge');
    });

    it('equipe sem súmula em par confirmado cancela normalmente', async () => {
      await confirm();
      await http()
        .patch('/events/G1/registrations/201/status')
        .set(bearer(tA))
        .send({ status: 'cancelled' })
        .expect(200);
    });
  });

  describe('categoria e regra de pontuação', () => {
    it('excluir categoria com WOD confirmado: 409; sem confirmação (outra categoria) passa', async () => {
      await confirm();
      await http().delete('/events/G1/categories/1').set(bearer(tA)).expect(409);
      await http().delete('/events/G1/categories/2').set(bearer(tA)).expect(200);
    });

    it('mudar scoringMode com WOD confirmado: 409; reenviar os mesmos valores: 200', async () => {
      await http().put('/events/G1').set(bearer(tA)).send({ scoringMode: 'points_table' }).expect(200);
      await confirm();
      await http().put('/events/G1').set(bearer(tA)).send({ scoringMode: 'rank_sum' }).expect(409);
      await http().put('/events/G1').set(bearer(tA)).send({ scoringMode: 'points_table' }).expect(200);
      await http().put('/events/G1').set(bearer(tA)).send({ name: 'Novo nome' }).expect(200);
    });

    it('depois de reverter a regra pode mudar', async () => {
      await confirm();
      await http().post(`${base}/revert`).set(bearer(tA)).send({ reason: 'motivo válido' }).expect(200);
      await http().put('/events/G1').set(bearer(tA)).send({ scoringMode: 'rank_sum' }).expect(200);
    });
  });

  describe('backup e exclusão do campeonato', () => {
    it('importar backup: ORGANIZER recebe 409 com resultado ativo; SUPER_ADMIN é permitido', async () => {
      await confirm();
      await http().post('/backup/import').set(bearer(tA)).send({}).expect(409);
      const res = await http().post('/backup/import').set(bearer(tSuper)).send({});
      expect(res.status).not.toBe(409);
      expect(res.status).toBeLessThan(500);
    });

    it('apagar o campeonato (SUPER_ADMIN) segue funcionando e remove os resultados oficiais em cascata', async () => {
      await confirm();
      expect(await ctx.prisma.officialResult.count()).toBe(1);
      await http().delete('/events/G1').set(bearer(tSuper)).expect(200);
      expect(await ctx.prisma.officialResult.count()).toBe(0);
      expect(await ctx.prisma.officialResultRow.count()).toBe(0);
    });
  });
});
