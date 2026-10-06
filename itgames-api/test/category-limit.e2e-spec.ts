import * as request from 'supertest';
import {
  bearer,
  configureMail,
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

describe('Limite de inscrições por categoria (e2e)', () => {
  let ctx: TestCtx;
  let tOrg: string;
  let tAdmin: string;
  let tA: string;
  let tB: string;
  let tC: string;
  const http = () => request(ctx.app.getHttpServer());

  const setLimit = (max: number | null, code = 1) =>
    ctx.prisma.category.update({ where: { code_gamesId: { code, gamesId: 'G1' } }, data: { maxRegistrations: max } });

  const register = (token: string, cpf: string, categoryId = 1) =>
    http()
      .post('/events/G1/registrations')
      .set(bearer(token))
      .send({ categoryId, teamName: `Equipe ${cpf}`, athletes: [{ cpf }] });

  const patchStatus = (code: number, status: string) =>
    http().patch(`/events/G1/registrations/${code}/status`).set(bearer(tOrg)).send({ status });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    ctx.mail.sent.length = 0;
    ctx.mail.failWith = null;

    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    const org = await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER', name: 'Org' });
    await createUser(ctx.prisma, { email: 'a@t.com', role: 'ATHLETE', cpf: CPF_A, name: 'Atleta A' });
    await createUser(ctx.prisma, { email: 'b@t.com', role: 'ATHLETE', cpf: CPF_B, name: 'Atleta B' });
    await createUser(ctx.prisma, { email: 'c@t.com', role: 'ATHLETE', cpf: CPF_C, name: 'Atleta C' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tOrg = await login(ctx.app, 'org@t.com');
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tC = await login(ctx.app, 'c@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [org.id] });
    await createCategoryFixture(ctx.prisma, 'G1', 1); // RX
    await createCategoryFixture(ctx.prisma, 'G1', 2);
  });

  describe('listagem de categorias', () => {
    it('sem limite: maxRegistrations e spotsLeft nulos; com limite: conta só as não canceladas', async () => {
      let res = await http().get('/events/G1/categories').expect(200);
      expect(res.body[0]).toMatchObject({ maxRegistrations: null, registrationsCount: 0, spotsLeft: null });

      await setLimit(3);
      const r1 = await register(tA, CPF_A).expect(201);
      await register(tB, CPF_B).expect(201);
      await patchStatus(r1.body.registration.code, 'cancelled').expect(200);

      res = await http().get('/events/G1/categories').expect(200);
      expect(res.body[0]).toMatchObject({ maxRegistrations: 3, registrationsCount: 1, spotsLeft: 2 });
      expect(res.body[1]).toMatchObject({ maxRegistrations: null, spotsLeft: null }); // outra categoria
    });
  });

  describe('inscrição', () => {
    it('inscreve até o limite e a seguinte recebe 409 com o nome da categoria', async () => {
      await setLimit(2);
      await register(tA, CPF_A).expect(201);
      await register(tB, CPF_B).expect(201);
      const res = await register(tC, CPF_C).expect(409);
      expect(res.body.message).toMatch(/esgotada/i);
      expect(res.body.message).toContain('RX');
      expect(res.body.message).toContain('2');
    });

    it('sem limite não restringe; o limite de uma categoria não afeta outra', async () => {
      await setLimit(1, 1);
      await register(tA, CPF_A).expect(201);
      await register(tB, CPF_B).expect(409);
      await register(tB, CPF_B, 2).expect(201); // categoria 2 sem limite
      await register(tC, CPF_C, 2).expect(201);
    });

    it('cancelar uma inscrição libera a vaga na hora', async () => {
      await setLimit(1);
      const r1 = await register(tA, CPF_A).expect(201);
      await register(tB, CPF_B).expect(409);
      await patchStatus(r1.body.registration.code, 'cancelled').expect(200);
      await register(tB, CPF_B).expect(201);
    });

    it('pendente e paga ocupam vaga; cancelada não', async () => {
      await setLimit(2);
      const r1 = await register(tA, CPF_A).expect(201);
      await patchStatus(r1.body.registration.code, 'paid').expect(200);
      await register(tB, CPF_B).expect(201); // pendente
      await register(tC, CPF_C).expect(409);
    });

    it('duas inscrições simultâneas na última vaga: só uma passa', async () => {
      await setLimit(1);
      const [x, y] = await Promise.all([register(tA, CPF_A), register(tB, CPF_B)]);
      expect([x.status, y.status].sort()).toEqual([201, 409]);
      const count = await ctx.prisma.registration.count({ where: { gameCode: 'G1', categoryId: 1 } });
      expect(count).toBe(1);
    });

    it('categoria cheia não bloqueia quem tenta de novo depois de abrir vaga (mensagem muda para sucesso)', async () => {
      await setLimit(1);
      const r1 = await register(tA, CPF_A).expect(201);
      await register(tB, CPF_B).expect(409);
      await setLimit(2);
      await register(tB, CPF_B).expect(201);
      expect(r1.body.success).toBe(true);
    });
  });

  describe('reativar inscrição cancelada', () => {
    it('em categoria cheia retorna 409; com vaga, reativa', async () => {
      await setLimit(1);
      const r1 = await register(tA, CPF_A).expect(201);
      await patchStatus(r1.body.registration.code, 'cancelled').expect(200);
      await register(tB, CPF_B).expect(201); // ocupa a única vaga

      const blocked = await patchStatus(r1.body.registration.code, 'pending').expect(409);
      expect(blocked.body.message).toMatch(/esgotada/i);

      await setLimit(2);
      await patchStatus(r1.body.registration.code, 'pending').expect(200);
    });

    it('mudar de pendente para paga numa categoria cheia não é bloqueado', async () => {
      await setLimit(1);
      const r1 = await register(tA, CPF_A).expect(201);
      await patchStatus(r1.body.registration.code, 'paid').expect(200);
    });
  });

  describe('configuração do limite (organizador)', () => {
    const update = (body: object, code = 1) =>
      http().put(`/events/G1/categories/${code}`).set(bearer(tOrg)).send(body);

    it('define, altera e remove o limite', async () => {
      const set = await update({ maxRegistrations: 10 }).expect(200);
      expect(set.body.maxRegistrations).toBe(10);
      const cleared = await update({ maxRegistrations: null }).expect(200);
      expect(cleared.body.maxRegistrations).toBeNull();
    });

    it('rejeita limite que não é inteiro positivo', async () => {
      for (const bad of [0, -3, 2.5, 'abc']) {
        const res = await update({ maxRegistrations: bad }).expect(400);
        expect(res.body.message).toMatch(/limite/i);
      }
    });

    it('não deixa baixar o limite abaixo do que já está ocupado, mas aceita igual ao ocupado', async () => {
      await register(tA, CPF_A).expect(201);
      await register(tB, CPF_B).expect(201);
      const res = await update({ maxRegistrations: 1 }).expect(400);
      expect(res.body.message).toMatch(/2/);
      await update({ maxRegistrations: 2 }).expect(200);
    });

    it('criar categoria já com limite; limite inválido na criação retorna 400', async () => {
      const ok = await http()
        .post('/events/G1/categories')
        .set(bearer(tOrg))
        .send({ name: 'Nova', maxRegistrations: 5 })
        .expect(201);
      expect(ok.body.maxRegistrations).toBe(5);
      await http().post('/events/G1/categories').set(bearer(tOrg)).send({ name: 'Ruim', maxRegistrations: 0 }).expect(400);
    });

    it('super admin também configura', async () => {
      await http().put('/events/G1/categories/1').set(bearer(tAdmin)).send({ maxRegistrations: 4 }).expect(200);
    });
  });

  describe('alerta de categoria esgotada (e-mail aos organizadores)', () => {
    beforeEach(async () => {
      await configureMail(ctx);
    });
    const fullMails = () => ctx.mail.sent.filter((m) => m.subject.startsWith('Categoria esgotada'));

    it('avisa os organizadores ativos uma vez, quando a última vaga é preenchida', async () => {
      await setLimit(2);
      await register(tA, CPF_A).expect(201);
      await ctx.idle();
      expect(fullMails()).toHaveLength(0);

      await register(tB, CPF_B).expect(201);
      await ctx.idle();
      expect(fullMails()).toHaveLength(1);
      expect(fullMails()[0].to).toBe('org@t.com');
      expect(fullMails()[0].subject).toBe('Categoria esgotada — RX');
      expect(fullMails()[0].text).toContain('2');

      await register(tC, CPF_C).expect(409); // tentativa recusada não reenvia
      await ctx.idle();
      expect(fullMails()).toHaveLength(1);
    });

    it('sem limite nunca envia; organizador suspenso não recebe', async () => {
      await register(tA, CPF_A).expect(201);
      await ctx.idle();
      expect(fullMails()).toHaveLength(0);

      await ctx.prisma.gameOrganizer.updateMany({ where: { gameCode: 'G1' }, data: { active: false } });
      await setLimit(2);
      await register(tB, CPF_B).expect(201);
      await ctx.idle();
      expect(fullMails()).toHaveLength(0);
    });
  });
});
