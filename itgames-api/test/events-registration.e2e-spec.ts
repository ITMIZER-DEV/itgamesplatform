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

describe('Events: categorias, WODs e inscrições (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let tAdmin: string;
  let tA: string;
  let tB: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());

  const registration = {
    categoryId: 1,
    teamName: 'Time A',
    athletes: [{ cpf: CPF_A }],
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
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'atleta@t.com', role: 'ATHLETE', cpf: CPF_A, name: 'Atleta Um' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tA = await login(ctx.app, 'a@t.com');
    tB = await login(ctx.app, 'b@t.com');
    tAthlete = await login(ctx.app, 'atleta@t.com');

    await createGameFixture(ctx.prisma, 'LIVE1', { status: 'live', organizerIds: [orgA.id] });
    await createGameFixture(ctx.prisma, 'DRAFT1', { status: 'draft', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'LIVE1');
    await createCategoryFixture(ctx.prisma, 'DRAFT1');
  });

  it('inscrição em campeonato draft retorna 400; em live retorna 201; inexistente retorna 404', async () => {
    const draft = await http().post('/events/DRAFT1/registrations').set(bearer(tAthlete)).send(registration).expect(400);
    expect(draft.body.message).toBe('Inscrições indisponíveis: campeonato não liberado');

    const live = await http().post('/events/LIVE1/registrations').set(bearer(tAthlete)).send(registration).expect(201);
    expect(live.body.success).toBe(true);
    expect(live.body.registration.athletes[0].name).toBe('Atleta Um');

    await http().post('/events/NAOEXISTE/registrations').set(bearer(tAthlete)).send(registration).expect(404);
  });

  it('inscrição em campeonato bloqueado retorna 400', async () => {
    await ctx.prisma.game.update({ where: { code: 'LIVE1' }, data: { status: 'blocked' } });
    await http().post('/events/LIVE1/registrations').set(bearer(tAthlete)).send(registration).expect(400);
  });

  describe('exige cadastro de atleta validado por CPF', () => {
    const post = (token: string | null, body: any, game = 'LIVE1') => {
      const req = http().post(`/events/${game}/registrations`);
      return (token ? req.set(bearer(token)) : req).send(body);
    };

    it('sem login retorna 401; organizador sem CPF no cadastro retorna 400 (organizador com CPF: ver organizer-suspension)', async () => {
      await post(null, registration).expect(401);
      const res = await post(tA, registration).expect(400);
      expect(res.body.message).toMatch(/CPF/);
    });

    it('capitão sem CPF no cadastro retorna 400', async () => {
      await createUser(ctx.prisma, { email: 'semcpf@t.com', role: 'ATHLETE' });
      const t = await login(ctx.app, 'semcpf@t.com');
      const res = await post(t, { categoryId: 1, teamName: 'X', athletes: [{ cpf: CPF_A }] }).expect(400);
      expect(res.body.message).toMatch(/CPF/);
    });

    describe('dupla', () => {
      beforeEach(async () => {
        await createCategoryFixture(ctx.prisma, 'LIVE1', 2);
        await ctx.prisma.category.update({
          where: { code_gamesId: { code: 2, gamesId: 'LIVE1' } },
          data: { maxAthlete: 2, teamType: 'pair' },
        });
      });
      const dupla = (second: any) => ({ categoryId: 2, teamName: 'Dupla', athletes: [{ cpf: CPF_A }, second] });

      it('CPF com dígitos verificadores inválidos retorna 400', async () => {
        const res = await post(tAthlete, dupla({ cpf: '12345678900' })).expect(400);
        expect(res.body.message).toMatch(/CPF inválido/);
      });

      it('parceiro sem cadastro retorna 400 informando o CPF mascarado', async () => {
        const res = await post(tAthlete, dupla({ cpf: CPF_B })).expect(400);
        expect(res.body.message).toContain('não possui cadastro de atleta');
        expect(res.body.message).toContain('***.***.***-35');
        expect(res.body.message).not.toContain(CPF_B);
      });

      it('e-mail informado que não bate com o do CPF retorna 400', async () => {
        await createUser(ctx.prisma, { email: 'b@atl.com', role: 'ATHLETE', cpf: CPF_B, name: 'Parceiro B' });
        const res = await post(tAthlete, dupla({ cpf: CPF_B, email: 'outro@atl.com' })).expect(400);
        expect(res.body.message).toMatch(/e-mail/);
      });

      it('mesmo CPF duas vezes retorna 400', async () => {
        const res = await post(tAthlete, dupla({ cpf: CPF_A })).expect(400);
        expect(res.body.message).toMatch(/repetido/);
      });

      it('capitão fora da lista retorna 400', async () => {
        await createUser(ctx.prisma, { email: 'b@atl.com', role: 'ATHLETE', cpf: CPF_B });
        await createUser(ctx.prisma, { email: 'c@atl.com', role: 'ATHLETE', cpf: CPF_C });
        const res = await post(tAthlete, {
          categoryId: 2,
          teamName: 'Sem capitão',
          athletes: [{ cpf: CPF_B }, { cpf: CPF_C }],
        }).expect(400);
        expect(res.body.message).toMatch(/capitão/i);
      });

      it('dupla com os dois cadastrados retorna 201 e copia os dados do perfil', async () => {
        await createUser(ctx.prisma, {
          email: 'b@atl.com',
          role: 'ATHLETE',
          cpf: CPF_B,
          name: 'Parceiro B',
          gender: 'F',
          tshirtSize: 'P',
          phoneNumber: '11999990000',
        });
        const res = await post(tAthlete, dupla({ cpf: CPF_B, email: 'B@atl.com' })).expect(201);
        const athletes = res.body.registration.athletes;
        expect(athletes).toHaveLength(2);
        expect(athletes[0]).toMatchObject({ name: 'Atleta Um' });
        expect(athletes[1]).toMatchObject({ name: 'Parceiro B', gender: 'F', tshirtSize: 'P' });
        // dados pessoais do parceiro não voltam para o capitão
        expect(JSON.stringify(res.body)).not.toContain(CPF_B);
        expect(JSON.stringify(res.body)).not.toContain('11999990000');
        // mas foram gravados a partir do cadastro dele
        const saved = await ctx.prisma.athlete.findFirst({ where: { cpf: CPF_B } });
        expect(saved).toMatchObject({ name: 'Parceiro B', phonenumber: '11999990000' });
      });

      it('CPF já inscrito na mesma categoria retorna 409', async () => {
        await createUser(ctx.prisma, { email: 'b@atl.com', role: 'ATHLETE', cpf: CPF_B });
        await post(tAthlete, dupla({ cpf: CPF_B })).expect(201);
        const res = await post(tAthlete, dupla({ cpf: CPF_B })).expect(409);
        expect(res.body.message).toMatch(/já inscrito/);
      });
    });

    it('lookup de CPF: exige login e devolve só nome parcial e CPF mascarado', async () => {
      await http().get(`/athletes/lookup?cpf=${CPF_A}`).expect(401);
      const ok = await http().get(`/athletes/lookup?cpf=${CPF_A}`).set(bearer(tAthlete)).expect(200);
      expect(ok.body).toEqual({ found: true, firstName: 'Atleta', cpfMasked: '***.***.***-25' });
      const none = await http().get(`/athletes/lookup?cpf=${CPF_B}`).set(bearer(tAthlete)).expect(200);
      expect(none.body).toEqual({ found: false, cpfMasked: '***.***.***-35' });
      await http().get('/athletes/lookup?cpf=123').set(bearer(tAthlete)).expect(400);
    });
  });

  it('listar inscrições: anônimo 401, atleta 403, organizador não vinculado 403, vinculado e super admin 200', async () => {
    await http().get('/events/LIVE1/registrations').expect(401);
    await http().get('/events/LIVE1/registrations').set(bearer(tAthlete)).expect(403);
    await http().get('/events/LIVE1/registrations').set(bearer(tB)).expect(403);
    await http().get('/events/LIVE1/registrations').set(bearer(tA)).expect(200);
    await http().get('/events/LIVE1/registrations').set(bearer(tAdmin)).expect(200);
  });

  it('categorias: leitura pública só de campeonato live; draft 404 para visitante e 200 para vinculado', async () => {
    await http().get('/events/LIVE1/categories').expect(200);
    await http().get('/events/DRAFT1/categories').expect(404);
    await http().get('/events/DRAFT1/categories').set(bearer(tB)).expect(404);
    await http().get('/events/DRAFT1/categories').set(bearer(tA)).expect(200);
  });

  it('categorias: criação exige vínculo (organizador B recebe 403; A recebe 201; anônimo 401)', async () => {
    const payload = { name: 'Nova', maxAthlete: 1 };
    await http().post('/events/DRAFT1/categories').send(payload).expect(401);
    await http().post('/events/DRAFT1/categories').set(bearer(tB)).send(payload).expect(403);
    await http().post('/events/DRAFT1/categories').set(bearer(tA)).send(payload).expect(201);
  });

  it('WODs: criação exige vínculo e leitura de draft é restrita', async () => {
    const payload = { code: 1, category: 1, title: 'Fran', type: 'for_time' };
    await http().post('/events/DRAFT1/workouts').set(bearer(tB)).send(payload).expect(403);
    await http().post('/events/DRAFT1/workouts').set(bearer(tA)).send(payload).expect(201);
    await http().get('/events/DRAFT1/workouts').expect(404);
    await http().get('/events/DRAFT1/workouts').set(bearer(tA)).expect(200);
  });

  it('atualizar status da inscrição: exige organizador vinculado; atualiza status e check-in', async () => {
    await ctx.prisma.registration.create({
      data: { code: 1101, categoryId: 1, gameCode: 'LIVE1', team: 'Time A', status: 'pending' },
    });
    const body = { status: 'paid', check: true };
    await http().patch('/events/LIVE1/registrations/1101/status').send(body).expect(401);
    await http().patch('/events/LIVE1/registrations/1101/status').set(bearer(tAthlete)).send(body).expect(403);
    await http().patch('/events/LIVE1/registrations/1101/status').set(bearer(tB)).send(body).expect(403);
    const ok = await http().patch('/events/LIVE1/registrations/1101/status').set(bearer(tA)).send(body).expect(200);
    expect(ok.body.status).toBe('paid');
    expect(ok.body.check).toBe(true);
    await http().patch('/events/LIVE1/registrations/9999/status').set(bearer(tA)).send(body).expect(404);
  });
});
