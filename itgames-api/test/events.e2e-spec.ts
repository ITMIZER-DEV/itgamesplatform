import * as request from 'supertest';
import { bearer, createGameFixture, createTestApp, createUser, login, resetDb, TestCtx } from './helpers';

describe('Events: campeonatos, status e organizadores (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let orgB: { id: string };
  let tAdmin: string;
  let tA: string;
  let tB: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER', name: 'Org A' });
    orgB = await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER', name: 'Org B' });
    await createUser(ctx.prisma, { email: 'atleta@t.com', role: 'ATHLETE' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tAthlete = await login(ctx.app, 'atleta@t.com');
  });

  describe('leitura', () => {
    beforeEach(async () => {
      await createGameFixture(ctx.prisma, 'LIVE1', { status: 'live', organizerIds: [orgA.id] });
      await createGameFixture(ctx.prisma, 'DRAFT1', { status: 'draft', organizerIds: [orgA.id] });
    });

    it('GET /events anônimo lista somente campeonatos live, sem e-mail dos organizadores', async () => {
      const res = await http().get('/events').expect(200);
      expect(res.body.map((g: any) => g.code)).toEqual(['LIVE1']);
      expect(res.body[0].organizers).toEqual([{ id: orgA.id, name: 'Org A' }]);
    });

    it('GET /events/:code de campeonato draft: 404 para anônimo e para organizador não vinculado', async () => {
      await http().get('/events/DRAFT1').expect(404);
      await http().get('/events/DRAFT1').set(bearer(tB)).expect(404);
      await http().get('/events/DRAFT1').set(bearer(tAthlete)).expect(404);
    });

    it('GET /events/:code de campeonato draft: 200 para organizador vinculado e super admin, com contatos', async () => {
      const a = await http().get('/events/DRAFT1').set(bearer(tA)).expect(200);
      expect(a.body.organizers[0].email).toBe('a@t.com');
      await http().get('/events/DRAFT1').set(bearer(tAdmin)).expect(200);
    });

    it('token inválido em rota pública é tratado como visitante (Review Focus 1)', async () => {
      await http().get('/events/LIVE1').set('Authorization', 'Bearer token-invalido').expect(200);
      await http().get('/events').set('Authorization', 'Bearer token-invalido').expect(200);
    });

    it('GET /events/mine: organizador vê só os seus; super admin vê todos; atleta 403; anônimo 401', async () => {
      await createGameFixture(ctx.prisma, 'B-DRAFT', { status: 'draft', organizerIds: [orgB.id] });
      const a = await http().get('/events/mine').set(bearer(tA)).expect(200);
      expect(a.body.map((g: any) => g.code).sort()).toEqual(['DRAFT1', 'LIVE1']);
      const admin = await http().get('/events/mine').set(bearer(tAdmin)).expect(200);
      expect(admin.body.map((g: any) => g.code).sort()).toEqual(['B-DRAFT', 'DRAFT1', 'LIVE1']);
      await http().get('/events/mine').set(bearer(tAthlete)).expect(403);
      await http().get('/events/mine').expect(401);
    });
  });

  describe('criação e edição', () => {
    it('POST /events: anônimo 401, atleta 403', async () => {
      await http().post('/events').send({ code: 'X1', name: 'X' }).expect(401);
      await http().post('/events').set(bearer(tAthlete)).send({ code: 'X1', name: 'X' }).expect(403);
    });

    it('organizador cria campeonato sempre em draft, vinculado a ele, com código em maiúsculas', async () => {
      const res = await http()
        .post('/events')
        .set(bearer(tA))
        .send({ code: 'copa-1', name: 'Copa 1', status: 'live' })
        .expect(201);
      expect(res.body.code).toBe('COPA-1');
      expect(res.body.status).toBe('draft');
      expect(res.body.organizers.map((o: any) => o.id)).toEqual([orgA.id]);
    });

    it('super admin cria campeonato em draft sem ser vinculado como organizador', async () => {
      const res = await http().post('/events').set(bearer(tAdmin)).send({ code: 'ADM-1', name: 'Adm' }).expect(201);
      expect(res.body.status).toBe('draft');
      expect(res.body.organizers).toEqual([]);
    });

    it('código duplicado retorna 409; campos obrigatórios ausentes retornam 400', async () => {
      await http().post('/events').set(bearer(tA)).send({ code: 'DUP', name: 'Um' }).expect(201);
      await http().post('/events').set(bearer(tA)).send({ code: 'dup', name: 'Dois' }).expect(409);
      await http().post('/events').set(bearer(tA)).send({ name: 'Sem código' }).expect(400);
    });

    it('PUT: vinculado edita e não consegue alterar status; não vinculado recebe 403', async () => {
      await createGameFixture(ctx.prisma, 'G1', { status: 'draft', organizerIds: [orgA.id] });
      const res = await http()
        .put('/events/G1')
        .set(bearer(tA))
        .send({ name: 'Novo Nome', status: 'live' })
        .expect(200);
      expect(res.body.name).toBe('Novo Nome');
      expect(res.body.status).toBe('draft');
      await http().put('/events/G1').set(bearer(tB)).send({ name: 'Invasor' }).expect(403);
      await http().put('/events/G1').send({ name: 'Anônimo' }).expect(401);
    });
  });

  describe('status e exclusão', () => {
    beforeEach(async () => {
      await createGameFixture(ctx.prisma, 'G1', { status: 'draft', organizerIds: [orgA.id] });
    });

    it('organizador não altera status; super admin libera', async () => {
      await http().patch('/events/G1/status').set(bearer(tA)).send({ status: 'live' }).expect(403);
      await http().patch('/events/G1/status').set(bearer(tAdmin)).send({ status: 'live' }).expect(200);
      const game = await ctx.prisma.game.findUnique({ where: { code: 'G1' } });
      expect(game.status).toBe('live');
    });

    it('status inválido retorna 400', async () => {
      await http().patch('/events/G1/status').set(bearer(tAdmin)).send({ status: 'foo' }).expect(400);
    });

    it('organizador não exclui; super admin exclui removendo vínculos sem apagar o usuário (Review Focus 5)', async () => {
      await http().delete('/events/G1').set(bearer(tA)).expect(403);
      await http().delete('/events/G1').set(bearer(tAdmin)).expect(200);
      expect(await ctx.prisma.game.count({ where: { code: 'G1' } })).toBe(0);
      expect(await ctx.prisma.gameOrganizer.count({ where: { gameCode: 'G1' } })).toBe(0);
      expect(await ctx.prisma.user.findUnique({ where: { id: orgA.id } })).not.toBeNull();
    });
  });

  describe('vários organizadores', () => {
    beforeEach(async () => {
      await createGameFixture(ctx.prisma, 'G1', { status: 'draft', organizerIds: [orgA.id] });
    });

    it('só o super admin vincula; depois do vínculo os dois organizadores editam', async () => {
      await http().post('/events/G1/organizers').set(bearer(tA)).send({ userId: orgB.id }).expect(403);
      const res = await http().post('/events/G1/organizers').set(bearer(tAdmin)).send({ userId: orgB.id }).expect(201);
      expect(res.body.map((o: any) => o.id).sort()).toEqual([orgA.id, orgB.id].sort());

      await http().put('/events/G1').set(bearer(tA)).send({ name: 'Por A' }).expect(200);
      await http().put('/events/G1').set(bearer(tB)).send({ name: 'Por B' }).expect(200);
    });

    it('vincular usuário que não é organizador retorna 400; campeonato inexistente retorna 404', async () => {
      const athlete = await ctx.prisma.user.findUnique({ where: { email: 'atleta@t.com' } });
      await http().post('/events/G1/organizers').set(bearer(tAdmin)).send({ userId: athlete.id }).expect(400);
      await http().post('/events/NAOEXISTE/organizers').set(bearer(tAdmin)).send({ userId: orgB.id }).expect(404);
      await http().post('/events/G1/organizers').set(bearer(tAdmin)).send({ userId: 'nao-e-uuid' }).expect(400);
    });

    it('desvincular remove o acesso imediatamente (Review Focus 3)', async () => {
      await http().post('/events/G1/organizers').set(bearer(tAdmin)).send({ userId: orgB.id }).expect(201);
      await http().put('/events/G1').set(bearer(tB)).send({ name: 'Ainda posso' }).expect(200);

      await http().delete(`/events/G1/organizers/${orgB.id}`).set(bearer(tB)).expect(403);
      await http().delete(`/events/G1/organizers/${orgB.id}`).set(bearer(tAdmin)).expect(200);

      await http().put('/events/G1').set(bearer(tB)).send({ name: 'Não posso mais' }).expect(403);
    });
  });
});
