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

describe('Inscrições: cancelar/excluir e edição de organizador (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let orgB: { id: string };
  let tAdmin: string;
  let tA: string;
  let tB: string;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN', name: 'Admin' });
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER', name: 'Org A' });
    orgB = await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER', name: 'Org B' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'G1');
    await ctx.prisma.workout.create({ data: { code: 1, game: 'G1', category: 1, title: 'WOD 1', type: 'for_time' } });
    for (const code of [101, 102]) {
      await ctx.prisma.registration.create({ data: { code, categoryId: 1, gameCode: 'G1', team: `T${code}`, status: 'paid' } });
    }
    const heat = await ctx.prisma.heat.create({
      data: { gameCode: 'G1', categoryId: 1, workoutCode: 1, heatNumber: 1, startTime: '08:00' },
    });
    await ctx.prisma.laneSlot.createMany({
      data: [
        { heatId: heat.id, laneNumber: 1, teamCode: 101, gameCode: 'G1' },
        { heatId: heat.id, laneNumber: 2, teamCode: 102, gameCode: 'G1' },
      ],
    });
    await ctx.prisma.event.create({ data: { idEvent: 1, game: 'G1', category: 1, title: 'WOD 1', workout: 1 } });
    await ctx.prisma.score.create({
      data: { idEvent: 1, game: 'G1', category: 1, codeTeam: 101, time: '05:00', judge: 'Juiz', scoreStatus: 'approved_by_head_judge' },
    });
  });

  describe('cancelar inscrição', () => {
    const cancel = { status: 'cancelled' };

    it('tira a equipe das baterias, anula as súmulas (mantendo o histórico) e audita', async () => {
      await http().patch('/events/G1/registrations/101/status').set(bearer(tA)).send(cancel).expect(200);

      expect(await ctx.prisma.laneSlot.count({ where: { gameCode: 'G1', teamCode: 101 } })).toBe(0);
      expect(await ctx.prisma.laneSlot.count({ where: { gameCode: 'G1', teamCode: 102 } })).toBe(1);

      const score = await ctx.prisma.score.findFirst({ where: { game: 'G1', codeTeam: 101 } });
      expect(score.scoreStatus).toBe('voided');

      const log = await ctx.prisma.auditLog.findFirst({ where: { gameCode: 'G1', action: 'void' } });
      expect(log.changedBy).toBe('Org A');
      expect(log.scoreId).toBe(score.code);
    });

    it('cancelar duas vezes não duplica a auditoria', async () => {
      await http().patch('/events/G1/registrations/101/status').set(bearer(tA)).send(cancel).expect(200);
      await http().patch('/events/G1/registrations/101/status').set(bearer(tA)).send(cancel).expect(200);
      expect(await ctx.prisma.auditLog.count({ where: { gameCode: 'G1', action: 'void' } })).toBe(1);
    });

    it('regerar baterias ignora inscrições canceladas', async () => {
      await http().patch('/events/G1/registrations/101/status').set(bearer(tA)).send(cancel).expect(200);
      const gen = await http()
        .post('/heats/generate')
        .set(bearer(tA))
        .send({ gameCode: 'G1', categoryId: 1, workoutCode: 1, totalLanes: 4, startHour: '08:00', intervalMinutes: 10 })
        .expect(201);
      const teams = gen.body.heats.flatMap((h: any) => h.slots.map((s: any) => s.teamCode));
      expect(teams).toEqual([102]);
    });

    it('reativar muda o status mas não restaura súmulas anuladas', async () => {
      await http().patch('/events/G1/registrations/101/status').set(bearer(tA)).send(cancel).expect(200);
      const res = await http()
        .patch('/events/G1/registrations/101/status')
        .set(bearer(tA))
        .send({ status: 'pending' })
        .expect(200);
      expect(res.body.status).toBe('pending');
      const score = await ctx.prisma.score.findFirst({ where: { game: 'G1', codeTeam: 101 } });
      expect(score.scoreStatus).toBe('voided');
    });

    it('organizador não vinculado recebe 403 e nada muda', async () => {
      await http().patch('/events/G1/registrations/101/status').set(bearer(tB)).send(cancel).expect(403);
      expect(await ctx.prisma.laneSlot.count({ where: { gameCode: 'G1', teamCode: 101 } })).toBe(1);
    });
  });

  describe('excluir inscrição', () => {
    it('organizador não vinculado recebe 403', async () => {
      await http().delete('/events/G1/registrations/101').set(bearer(tB)).expect(403);
      await http().delete('/events/G1/registrations/101').expect(401);
    });

    it('organizador não exclui inscrição com score ou em bateria (409) mas exclui uma sem vínculos', async () => {
      await http().delete('/events/G1/registrations/101').set(bearer(tA)).expect(409); // tem score e bateria
      await http().delete('/events/G1/registrations/102').set(bearer(tA)).expect(409); // só em bateria
      await ctx.prisma.registration.create({ data: { code: 103, categoryId: 1, gameCode: 'G1', team: 'T103' } });
      await http().delete('/events/G1/registrations/103').set(bearer(tA)).expect(200);
      expect(await ctx.prisma.registration.count({ where: { gameCode: 'G1', code: 103 } })).toBe(0);
    });

    it('super admin exclui mesmo com score e bateria; a auditoria é preservada', async () => {
      await http().delete('/events/G1/registrations/101').set(bearer(tAdmin)).expect(200);
      expect(await ctx.prisma.registration.count({ where: { gameCode: 'G1', code: 101 } })).toBe(0);
      expect(await ctx.prisma.score.count({ where: { game: 'G1', codeTeam: 101 } })).toBe(0);
      expect(await ctx.prisma.laneSlot.count({ where: { gameCode: 'G1', teamCode: 101 } })).toBe(0);
      const log = await ctx.prisma.auditLog.findFirst({ where: { gameCode: 'G1', action: 'registration_deleted' } });
      expect(log.changedBy).toBe('Admin');
    });

    it('inscrição inexistente retorna 404', async () => {
      await http().delete('/events/G1/registrations/9999').set(bearer(tA)).expect(404);
    });
  });

  describe('editar organizador', () => {
    it('só o super admin edita; e-mail é normalizado e atualizado', async () => {
      const body = { name: 'Org A Novo', email: '  NOVO@T.com ', phoneNumber: '11911112222' };
      await http().patch(`/users/organizers/${orgA.id}`).send(body).expect(401);
      await http().patch(`/users/organizers/${orgA.id}`).set(bearer(tA)).send(body).expect(403);

      const res = await http().patch(`/users/organizers/${orgA.id}`).set(bearer(tAdmin)).send(body).expect(200);
      expect(res.body.name).toBe('Org A Novo');
      expect(res.body.email).toBe('novo@t.com');
      expect(res.body.phoneNumber).toBe('11911112222');
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('e-mail de outro usuário retorna 409; o próprio e-mail é aceito; nome em branco retorna 400', async () => {
      await http().patch(`/users/organizers/${orgA.id}`).set(bearer(tAdmin)).send({ email: 'b@t.com' }).expect(409);
      await http().patch(`/users/organizers/${orgA.id}`).set(bearer(tAdmin)).send({ email: 'a@t.com', name: 'Mesmo' }).expect(200);
      await http().patch(`/users/organizers/${orgA.id}`).set(bearer(tAdmin)).send({ name: '   ' }).expect(400);
    });

    it('usuário que não é organizador ou inexistente retorna 404', async () => {
      const admin = await ctx.prisma.user.findUnique({ where: { email: 'admin@t.com' } });
      await http().patch(`/users/organizers/${admin.id}`).set(bearer(tAdmin)).send({ name: 'X' }).expect(404);
      await http()
        .patch('/users/organizers/00000000-0000-0000-0000-000000000000')
        .set(bearer(tAdmin))
        .send({ name: 'X' })
        .expect(404);
    });
  });
});
