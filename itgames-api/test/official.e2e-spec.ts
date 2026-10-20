import * as request from 'supertest';
import { bearer, createCategoryFixture, createGameFixture, createTestApp, createUser, login, resetDb, TestCtx } from './helpers';

describe('Cálculo oficial /official (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let tA: string;
  let tB: string;
  let tSuper: string;
  let tJudge: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());
  const base = '/official/G1/categories/1/events/1';

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER', name: 'Org A' });
    await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'su@t.com', role: 'SUPER_ADMIN', name: 'Super' });
    await createUser(ctx.prisma, { email: 'j@t.com', role: 'JUDGE' });
    await createUser(ctx.prisma, { email: 'at@t.com', role: 'ATHLETE' });
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tSuper = await login(ctx.app, 'su@t.com');
    tJudge = await login(ctx.app, 'j@t.com');
    tAthlete = await login(ctx.app, 'at@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'G1', 1);
    await ctx.prisma.workout.create({
      data: { code: 1, game: 'G1', category: 1, title: 'WOD 1', type: 'for_time', timeCap: '10:00' },
    });
    await ctx.prisma.event.create({ data: { idEvent: 1, game: 'G1', category: 1, title: 'WOD 1', workout: 1 } });
    for (const code of [101, 102, 103]) {
      await ctx.prisma.registration.create({
        data: { code, categoryId: 1, gameCode: 'G1', team: `Time ${code}`, status: 'paid', number: `#${code}` },
      });
    }
    const s = { game: 'G1', category: 1, idEvent: 1, judge: 'Juiz', scoreStatus: 'approved_by_head_judge' };
    await ctx.prisma.score.create({ data: { ...s, codeTeam: 101, time: '05:00' } });
    await ctx.prisma.score.create({ data: { ...s, codeTeam: 102, time: '06:00' } });
    // a equipe 103 não tem súmula: fica como W.O.
    await ctx.prisma.heat.create({
      data: { gameCode: 'G1', categoryId: 1, workoutCode: 1, heatNumber: 1, startTime: '09:00', status: 'completed' },
    });
  });

  const counts = async () => ({
    results: await ctx.prisma.officialResult.count(),
    rows: await ctx.prisma.officialResultRow.count(),
    logs: await ctx.prisma.officialLog.count(),
  });

  describe('permissões', () => {
    it('organizador vinculado vê a prévia e confirma; outro organizador recebe 403', async () => {
      await http().get(`${base}/preview`).set(bearer(tA)).expect(200);
      await http().get(`${base}/preview`).set(bearer(tB)).expect(403);
      await http().post(`${base}/confirm`).set(bearer(tB)).expect(403);
      await http().post(`${base}/confirm`).set(bearer(tA)).expect(200);
    });

    it('SUPER_ADMIN confirma qualquer campeonato', async () => {
      await http().post(`${base}/confirm`).set(bearer(tSuper)).expect(200);
    });

    it('JUDGE, ATHLETE e anônimo não acessam', async () => {
      for (const t of [tJudge, tAthlete]) {
        await http().get('/official/G1').set(bearer(t)).expect(403);
        await http().get(`${base}/preview`).set(bearer(t)).expect(403);
        await http().post(`${base}/confirm`).set(bearer(t)).expect(403);
        await http().post(`${base}/revert`).set(bearer(t)).send({ reason: 'motivo válido' }).expect(403);
        await http().get('/official/G1/history').set(bearer(t)).expect(403);
      }
      await http().get('/official/G1').expect(401);
    });

    it('WOD inexistente retorna 404', async () => {
      await http().get('/official/G1/categories/1/events/99/preview').set(bearer(tA)).expect(404);
    });
  });

  describe('prévia e status', () => {
    it('a prévia traz pontos, W.O. e não grava nada', async () => {
      const res = await http().get(`${base}/preview`).set(bearer(tA)).expect(200);
      expect(res.body.state).toBe('ready');
      expect(res.body.canConfirm).toBe(true);
      expect(res.body.rows).toHaveLength(3);
      expect(res.body.rows[0].teamCode).toBe(101);
      expect(res.body.rows[0].points).toBeGreaterThan(0);
      expect(res.body.woTeams).toEqual(['Time 103']);
      expect(await counts()).toEqual({ results: 0, rows: 0, logs: 0 });
    });

    it('o status lista categorias e WODs com o estado', async () => {
      const res = await http().get('/official/G1').set(bearer(tA)).expect(200);
      expect(res.body.categories[0].events[0]).toMatchObject({ eventId: 1, state: 'ready', confirmedAt: null });
      await http().post(`${base}/confirm`).set(bearer(tA)).expect(200);
      const after = await http().get('/official/G1').set(bearer(tA)).expect(200);
      expect(after.body.categories[0].events[0]).toMatchObject({ state: 'confirmed', confirmedByName: 'Org A' });
    });
  });

  describe('confirmar', () => {
    it('bateria em andamento bloqueia (409) e nada é gravado', async () => {
      await ctx.prisma.heat.updateMany({ where: { gameCode: 'G1' }, data: { status: 'in_progress' } });
      const res = await http().post(`${base}/confirm`).set(bearer(tA)).expect(409);
      expect(res.body.message).toContain('Baterias não encerradas');
      expect(await counts()).toEqual({ results: 0, rows: 0, logs: 0 });
    });

    it('súmula contestada bloqueia (409)', async () => {
      await ctx.prisma.score.updateMany({ where: { codeTeam: 101 }, data: { scoreStatus: 'contested' } });
      await http().post(`${base}/confirm`).set(bearer(tA)).expect(409);
      expect(await counts()).toEqual({ results: 0, rows: 0, logs: 0 });
    });

    it('todas as baterias encerradas: grava linhas de todas as equipes, W.O. por último', async () => {
      const res = await http().post(`${base}/confirm`).set(bearer(tA)).expect(200);
      expect(res.body.state).toBe('confirmed');
      expect(res.body.confirmedAt).toBeDefined();

      const result = await ctx.prisma.officialResult.findFirstOrThrow({ include: { rows: true } });
      expect(result.activeKey).toBe('G1:1:1');
      expect(result.teamCount).toBe(3);
      expect(result.woCount).toBe(1);
      expect(result.rows).toHaveLength(3);
      const wo = result.rows.find((r) => r.teamCode === 103)!;
      expect(wo.status).toBe('wo');
      expect(wo.rank).toBe(3); // última posição válida (2) + 1
      expect(await ctx.prisma.officialLog.count({ where: { action: 'confirm' } })).toBe(1);
    });

    it('confirmar de novo retorna 409', async () => {
      await http().post(`${base}/confirm`).set(bearer(tA)).expect(200);
      await http().post(`${base}/confirm`).set(bearer(tA)).expect(409);
      expect(await ctx.prisma.officialResult.count()).toBe(1);
    });

    it('duas confirmações simultâneas: exatamente uma 200 e uma 409', async () => {
      const [r1, r2] = await Promise.all([
        http().post(`${base}/confirm`).set(bearer(tA)),
        http().post(`${base}/confirm`).set(bearer(tSuper)),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      expect(await ctx.prisma.officialResult.count({ where: { activeKey: { not: null } } })).toBe(1);
      expect(await ctx.prisma.officialLog.count({ where: { action: 'confirm' } })).toBe(1);
    });
  });

  describe('reverter e histórico', () => {
    it('sem motivo (ou curto demais) retorna 400', async () => {
      await http().post(`${base}/confirm`).set(bearer(tA)).expect(200);
      await http().post(`${base}/revert`).set(bearer(tA)).send({}).expect(400);
      await http().post(`${base}/revert`).set(bearer(tA)).send({ reason: 'abc' }).expect(400);
      expect(await ctx.prisma.officialResult.count({ where: { activeKey: { not: null } } })).toBe(1);
    });

    it('sem resultado ativo retorna 409', async () => {
      await http().post(`${base}/revert`).set(bearer(tA)).send({ reason: 'motivo válido' }).expect(409);
    });

    it('com motivo libera o WOD, registra 2 linhas no log e permite confirmar de novo', async () => {
      await http().post(`${base}/confirm`).set(bearer(tA)).expect(200);
      await http().post(`${base}/revert`).set(bearer(tA)).send({ reason: 'Erro de digitação na súmula' }).expect(200);

      const result = await ctx.prisma.officialResult.findFirstOrThrow();
      expect(result.activeKey).toBeNull();
      expect(result.revertedAt).not.toBeNull();
      expect(result.revertReason).toBe('Erro de digitação na súmula');
      const logs = await ctx.prisma.officialLog.findMany({ orderBy: { createdAt: 'asc' } });
      expect(logs.map((l) => l.action)).toEqual(['confirm', 'revert']);

      await http().post(`${base}/confirm`).set(bearer(tA)).expect(200);
      expect(await ctx.prisma.officialResult.count()).toBe(2);
      expect(await ctx.prisma.officialResult.count({ where: { activeKey: { not: null } } })).toBe(1);
    });

    it('o histórico lista as ações, mais recentes primeiro', async () => {
      await http().post(`${base}/confirm`).set(bearer(tA)).expect(200);
      await http().post(`${base}/revert`).set(bearer(tA)).send({ reason: 'Erro de digitação' }).expect(200);
      const res = await http().get('/official/G1/history').set(bearer(tA)).expect(200);
      expect(res.body.map((l: any) => l.action)).toEqual(['revert', 'confirm']);
      expect(res.body[0].reason).toBe('Erro de digitação');
    });
  });
});
