import * as request from 'supertest';
import {
  bearer,
  CPF_A,
  CPF_B,
  CPF_C,
  createCategoryFixture,
  createGameFixture,
  createTestApp,
  createUser,
  login,
  resetDb,
  TestCtx,
} from './helpers';

describe('Organizador: suspensão no campeonato e inscrição como atleta (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let orgB: { id: string };
  let tAdmin: string;
  let tA: string;
  let tB: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());
  const patchActive = (token: string | null, game: string, userId: string, active: boolean) => {
    const req = http().patch(`/events/${game}/organizers/${userId}`);
    return (token ? req.set(bearer(token)) : req).send({ active });
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER', name: 'Org A', cpf: CPF_A });
    orgB = await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER', name: 'Org B', cpf: CPF_B });
    await createUser(ctx.prisma, { email: 'atleta@t.com', role: 'ATHLETE' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tAthlete = await login(ctx.app, 'atleta@t.com');

    // G1 e G2 liberados, ambos com A e B vinculados
    for (const code of ['G1', 'G2']) {
      await createGameFixture(ctx.prisma, code, { status: 'live', organizerIds: [orgA.id, orgB.id] });
      await createCategoryFixture(ctx.prisma, code);
    }
    await createGameFixture(ctx.prisma, 'DRAFT1', { status: 'draft', organizerIds: [orgA.id] });
  });

  describe('PATCH /events/:code/organizers/:userId', () => {
    it('só super admin: anônimo 401, atleta 403, organizador 403, admin 200', async () => {
      await patchActive(null, 'G1', orgA.id, false).expect(401);
      await patchActive(tAthlete, 'G1', orgA.id, false).expect(403);
      await patchActive(tA, 'G1', orgA.id, false).expect(403);
      await patchActive(tAdmin, 'G1', orgA.id, false).expect(200);
    });

    it('devolve a lista com o campo active e rejeita corpo inválido, campeonato inexistente e usuário sem vínculo', async () => {
      const res = await patchActive(tAdmin, 'G1', orgA.id, false).expect(200);
      const a = res.body.find((o: any) => o.id === orgA.id);
      const b = res.body.find((o: any) => o.id === orgB.id);
      expect(a.active).toBe(false);
      expect(b.active).toBe(true);

      await http().patch(`/events/G1/organizers/${orgA.id}`).set(bearer(tAdmin)).send({ active: 'x' }).expect(400);
      await patchActive(tAdmin, 'NAOEXISTE', orgA.id, false).expect(404);
      await patchActive(tAdmin, 'DRAFT1', orgB.id, false).expect(404); // B não está vinculado ao DRAFT1
    });
  });

  describe('organizador suspenso', () => {
    beforeEach(async () => {
      await patchActive(tAdmin, 'G1', orgA.id, false).expect(200);
    });

    it('perde a gestão só no campeonato suspenso; nos outros continua', async () => {
      await http().get('/events/G1/registrations').set(bearer(tA)).expect(403);
      await http().get('/events/G2/registrations').set(bearer(tA)).expect(200);
      await http().get('/events/G1/registrations').set(bearer(tB)).expect(200);
    });

    it('não vê o campeonato draft suspenso (404) e não o lista em "meus campeonatos"', async () => {
      await patchActive(tAdmin, 'DRAFT1', orgA.id, false).expect(200);
      await http().get('/events/DRAFT1').set(bearer(tA)).expect(404);
      const mine = await http().get('/events/mine').set(bearer(tA)).expect(200);
      expect(mine.body.map((g: any) => g.code).sort()).toEqual(['G2']);
    });

    it('some da lista pública de organização; admin ainda o vê, marcado como suspenso', async () => {
      const pub = await http().get('/events/G1').expect(200);
      expect(pub.body.organizers.map((o: any) => o.id)).toEqual([orgB.id]);

      const adm = await http().get('/events/G1').set(bearer(tAdmin)).expect(200);
      const a = adm.body.organizers.find((o: any) => o.id === orgA.id);
      expect(a.active).toBe(false);
    });

    it('reativar devolve o acesso', async () => {
      await patchActive(tAdmin, 'G1', orgA.id, true).expect(200);
      await http().get('/events/G1/registrations').set(bearer(tA)).expect(200);
    });
  });

  describe('organizador como competidor', () => {
    const body = { categoryId: 1, teamName: 'Org Time', athletes: [{ cpf: CPF_A }] };
    const register = (token: string, game = 'G1', payload: any = body) =>
      http().post(`/events/${game}/registrations`).set(bearer(token)).send(payload);

    it('organizador ativo do campeonato não pode competir nele (400)', async () => {
      const res = await register(tA).expect(400);
      expect(res.body.message).toMatch(/Organizador ativo deste campeonato/);
    });

    it('organizador ativo também não entra como parceiro de outro atleta', async () => {
      await createUser(ctx.prisma, { email: 'p@t.com', role: 'ATHLETE', cpf: CPF_C });
      const tP = await login(ctx.app, 'p@t.com');
      await ctx.prisma.category.update({
        where: { code_gamesId: { code: 1, gamesId: 'G1' } },
        data: { maxAthlete: 2, teamType: 'pair' },
      });
      const res = await register(tP, 'G1', {
        categoryId: 1,
        teamName: 'Dupla',
        athletes: [{ cpf: CPF_C }, { cpf: CPF_A }],
      }).expect(400);
      expect(res.body.message).toMatch(/Organizador ativo deste campeonato/);
    });

    it('suspenso consegue se inscrever, com os dados do cadastro e padrões do perfil', async () => {
      await patchActive(tAdmin, 'G1', orgA.id, false).expect(200);
      const res = await register(tA).expect(201);
      expect(res.body.registration.athletes[0]).toMatchObject({ name: 'Org A', gender: 'M', tshirtSize: 'M' });
    });

    it('removido do campeonato consegue se inscrever', async () => {
      await http().delete(`/events/G1/organizers/${orgA.id}`).set(bearer(tAdmin)).expect(200);
      await register(tA).expect(201);
    });

    it('organizador de outro campeonato consegue se inscrever', async () => {
      await createGameFixture(ctx.prisma, 'G3', { status: 'live', organizerIds: [orgB.id] });
      await createCategoryFixture(ctx.prisma, 'G3');
      await register(tA, 'G3').expect(201);
    });

    it('organizador sem CPF no cadastro continua recusado (400)', async () => {
      await createUser(ctx.prisma, { email: 'sem@t.com', role: 'ORGANIZER' });
      const t = await login(ctx.app, 'sem@t.com');
      const res = await register(t, 'G1').expect(400);
      expect(res.body.message).toMatch(/CPF/);
    });
  });
});
