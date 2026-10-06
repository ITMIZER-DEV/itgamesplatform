import * as request from 'supertest';
import {
  bearer,
  CPF_A,
  createCategoryFixture,
  createGameFixture,
  createTestApp,
  createUser,
  DEFAULT_PASSWORD,
  login,
  resetDb,
  TestCtx,
} from './helpers';

describe('Correções da revisão final (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let orgB: { id: string };
  let tA: string;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER' });
    orgB = await createUser(ctx.prisma, { email: 'b@t.com', role: 'ORGANIZER' });
    tA = await login(ctx.app, 'a@t.com');
  });

  it('C1: baterias públicas não expõem CPF, telefone nem data de nascimento dos atletas', async () => {
    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'G1');
    await ctx.prisma.workout.create({ data: { code: 1, game: 'G1', category: 1, title: 'WOD 1', type: 'for_time' } });
    await ctx.prisma.registration.create({
      data: {
        code: 101,
        categoryId: 1,
        gameCode: 'G1',
        team: 'Time A',
        athletes: {
          create: [
            {
              code: 1,
              name: 'Atleta Secreto',
              cpf: '12345678901',
              phonenumber: '11987654321',
              birthDate: new Date('1990-05-17'),
              category: 1,
            },
          ],
        },
      },
    });
    await http()
      .post('/heats/generate')
      .set(bearer(tA))
      .send({ gameCode: 'G1', categoryId: 1, workoutCode: 1, totalLanes: 4, startHour: '08:00', intervalMinutes: 10 })
      .expect(201);

    const res = await http().get('/heats/game/G1/workout/1').expect(200);
    const body = JSON.stringify(res.body);
    expect(body).toContain('Atleta Secreto');
    expect(body).not.toContain('12345678901');
    expect(body).not.toContain('11987654321');
    expect(body).not.toContain('1990-05-17');
  });

  it('I1: inscrição de atleta não consegue se declarar paga (status sempre pending)', async () => {
    await createGameFixture(ctx.prisma, 'LIVE1', { status: 'live', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'LIVE1');
    await createUser(ctx.prisma, { email: 'atl@t.com', role: 'ATHLETE', cpf: CPF_A });
    const tAth = await login(ctx.app, 'atl@t.com');
    const res = await http()
      .post('/events/LIVE1/registrations')
      .set(bearer(tAth))
      .send({ categoryId: 1, teamName: 'Time A', status: 'paid', athletes: [{ cpf: CPF_A }] })
      .expect(201);
    expect(res.body.registration.status).toBe('pending');
  });

  it('I2: swap-lanes entre slots de campeonatos diferentes é recusado e não altera nada', async () => {
    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id] });
    await createGameFixture(ctx.prisma, 'G2', { status: 'live', organizerIds: [orgB.id] });
    const slots: string[] = [];
    for (const g of ['G1', 'G2']) {
      await createCategoryFixture(ctx.prisma, g);
      await ctx.prisma.workout.create({ data: { code: 1, game: g, category: 1, title: 'WOD', type: 'for_time' } });
      await ctx.prisma.registration.create({ data: { code: 101, categoryId: 1, gameCode: g, team: `T-${g}` } });
      const heat = await ctx.prisma.heat.create({
        data: { gameCode: g, categoryId: 1, workoutCode: 1, heatNumber: 1, startTime: '08:00' },
      });
      const slot = await ctx.prisma.laneSlot.create({
        data: { heatId: heat.id, laneNumber: g === 'G1' ? 1 : 2, teamCode: 101, gameCode: g },
      });
      slots.push(slot.id);
    }

    await http().post('/heats/swap-lanes').set(bearer(tA)).send({ slotIdA: slots[0], slotIdB: slots[1] }).expect(400);

    const g2Slot = await ctx.prisma.laneSlot.findUnique({ where: { id: slots[1] } });
    expect(g2Slot.laneNumber).toBe(2);
  });

  it('I3: sessão com troca de senha pendente não bloqueia rotas públicas nem o login de outra conta', async () => {
    await createUser(ctx.prisma, { email: 'novo@t.com', role: 'ORGANIZER', mustChangePassword: true });
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    const pending = (
      await http().post('/auth/login').send({ email: 'novo@t.com', password: DEFAULT_PASSWORD }).expect(200)
    ).body.accessToken;

    await http().get('/events').set(bearer(pending)).expect(200);
    await http()
      .post('/auth/login')
      .set(bearer(pending))
      .send({ email: 'admin@t.com', password: DEFAULT_PASSWORD })
      .expect(200);
  });
});
