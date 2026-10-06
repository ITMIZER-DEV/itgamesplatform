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

describe('Scores, Heats e Audit (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let tA: string;
  let tB: string;
  let tJudge: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());

  const score = { idEvent: 1, game: 'G1', category: 1, codeTeam: 101, time: '05:00', judge: 'Roberto Juiz' };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'judge@t.com', role: 'JUDGE', name: 'Roberto Juiz' });
    await createUser(ctx.prisma, { email: 'atleta@t.com', role: 'ATHLETE' });
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tJudge = await login(ctx.app, 'judge@t.com');
    tAthlete = await login(ctx.app, 'atleta@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'G1');
    await ctx.prisma.registration.create({
      data: { code: 101, categoryId: 1, gameCode: 'G1', team: 'Time A' },
    });
    await ctx.prisma.workout.create({
      data: { code: 1, game: 'G1', category: 1, title: 'WOD 1', type: 'for_time' },
    });
  });

  describe('scores', () => {
    it('lançar score: anônimo 401, atleta 403, organizador não vinculado 403', async () => {
      await http().post('/scores').send(score).expect(401);
      await http().post('/scores').set(bearer(tAthlete)).send(score).expect(403);
      await http().post('/scores').set(bearer(tB)).send(score).expect(403);
    });

    it('juiz lança score e a auditoria registra o nome do token, o papel e o IP', async () => {
      await http().post('/scores').set(bearer(tJudge)).send(score).expect(201);
      const log = await ctx.prisma.auditLog.findFirst({ where: { gameCode: 'G1' } });
      expect(log.changedBy).toBe('Roberto Juiz');
      expect(log.role).toBe('judge');
      expect(log.ipAddress).toBeTruthy();
    });

    it('organizador vinculado lança score com papel organizer', async () => {
      await http().post('/scores').set(bearer(tA)).send(score).expect(201);
      const log = await ctx.prisma.auditLog.findFirst({ where: { gameCode: 'G1' } });
      expect(log.role).toBe('organizer');
    });

    it('listar scores e auditoria: apenas organizador vinculado/super admin', async () => {
      await http().get('/scores/game/G1').expect(401);
      await http().get('/scores/game/G1').set(bearer(tAthlete)).expect(403);
      await http().get('/scores/game/G1').set(bearer(tJudge)).expect(403);
      await http().get('/scores/game/G1').set(bearer(tB)).expect(403);
      await http().get('/scores/game/G1').set(bearer(tA)).expect(200);

      await http().get('/audit/game/G1').expect(401);
      await http().get('/audit/game/G1').set(bearer(tB)).expect(403);
      await http().get('/audit/game/G1').set(bearer(tA)).expect(200);
    });

    it('anexar foto: juiz pode; atleta não; score inexistente retorna 404', async () => {
      const created = await http().post('/scores').set(bearer(tJudge)).send(score).expect(201);
      const code = created.body.score.code;
      await http().patch(`/scores/${code}/photo`).set(bearer(tAthlete)).send({ photo: 'x' }).expect(403);
      await http().patch(`/scores/${code}/photo`).set(bearer(tJudge)).send({ photo: 'data:image/png;base64,AAAA' }).expect(200);
      await http().patch('/scores/999999/photo').set(bearer(tJudge)).send({ photo: 'x' }).expect(404);
    });
  });

  describe('heats', () => {
    const generate = { gameCode: 'G1', categoryId: 1, workoutCode: 1, totalLanes: 4, startHour: '08:00', intervalMinutes: 10 };

    it('gerar baterias: anônimo 401; juiz 403; organizador não vinculado 403; vinculado 201', async () => {
      await http().post('/heats/generate').send(generate).expect(401);
      await http().post('/heats/generate').set(bearer(tJudge)).send(generate).expect(403);
      await http().post('/heats/generate').set(bearer(tB)).send(generate).expect(403);
      const ok = await http().post('/heats/generate').set(bearer(tA)).send(generate).expect(201);
      expect(ok.body.success).toBe(true);
    });

    it('leitura de baterias: pública em campeonato live, restrita em draft', async () => {
      await http().get('/heats/game/G1/workout/1').expect(200);
      await ctx.prisma.game.update({ where: { code: 'G1' }, data: { status: 'draft' } });
      await http().get('/heats/game/G1/workout/1').expect(404);
      await http().get('/heats/game/G1/workout/1').set(bearer(tA)).expect(200);
    });

    it('status e troca de raias: respeitam papel e vínculo; ids inexistentes retornam 404', async () => {
      // a bateria precisa de duas equipes para ter dois slots a trocar
      await ctx.prisma.registration.create({
        data: { code: 102, categoryId: 1, gameCode: 'G1', team: 'Time B' },
      });
      const gen = await http().post('/heats/generate').set(bearer(tA)).send({ ...generate, totalLanes: 2 }).expect(201);
      const heat = gen.body.heats[0];
      const [slotA, slotB] = heat.slots;

      await http().patch(`/heats/${heat.id}/status`).set(bearer(tAthlete)).send({ status: 'calling' }).expect(403);
      await http().patch(`/heats/${heat.id}/status`).set(bearer(tB)).send({ status: 'calling' }).expect(403);
      await http().patch(`/heats/${heat.id}/status`).set(bearer(tJudge)).send({ status: 'calling' }).expect(200);

      await http().post('/heats/swap-lanes').set(bearer(tB)).send({ slotIdA: slotA.id, slotIdB: slotB.id }).expect(403);
      await http().post('/heats/swap-lanes').set(bearer(tA)).send({ slotIdA: slotA.id, slotIdB: slotB.id }).expect(201);

      await http().patch('/heats/nao-existe/status').set(bearer(tA)).send({ status: 'calling' }).expect(404);
      await http().post('/heats/swap-lanes').set(bearer(tA)).send({ slotIdA: 'x', slotIdB: 'y' }).expect(404);
    });
  });
});
