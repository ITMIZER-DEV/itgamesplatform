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
    athletes: [{ name: 'Atleta Um', gender: 'M' }],
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
    await createUser(ctx.prisma, { email: 'atleta@t.com', role: 'ATHLETE' });
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
    const draft = await http().post('/events/DRAFT1/registrations').send(registration).expect(400);
    expect(draft.body.message).toBe('Inscrições indisponíveis: campeonato não liberado');

    const live = await http().post('/events/LIVE1/registrations').send(registration).expect(201);
    expect(live.body.success).toBe(true);

    await http().post('/events/NAOEXISTE/registrations').send(registration).expect(404);
  });

  it('inscrição em campeonato bloqueado retorna 400', async () => {
    await ctx.prisma.game.update({ where: { code: 'LIVE1' }, data: { status: 'blocked' } });
    await http().post('/events/LIVE1/registrations').send(registration).expect(400);
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
