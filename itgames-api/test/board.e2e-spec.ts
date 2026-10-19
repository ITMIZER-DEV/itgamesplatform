import { AddressInfo } from 'net';
import * as request from 'supertest';
import { WebSocket } from 'ws';
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

describe('Placar /events/:code/board e websocket (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let tA: string;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER' });
    tA = await login(ctx.app, 'a@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'G1', 1);
    await ctx.prisma.category.create({
      data: { code: 2, gamesId: 'G1', name: 'Scaled', maxAthlete: 1, teamType: 'individual', genderRule: 'open' },
    });
    for (const [code, category] of [[1, 1], [2, 1]] as const) {
      await ctx.prisma.workout.create({
        data: { code, game: 'G1', category, title: `WOD ${code}`, type: 'for_time', timeCap: '10:00' },
      });
      await ctx.prisma.event.create({ data: { idEvent: code, game: 'G1', category, title: `WOD ${code}`, workout: code } });
    }
    for (const [code, status] of [[101, 'paid'], [102, 'paid'], [103, 'paid']] as const) {
      await ctx.prisma.registration.create({
        data: {
          code,
          categoryId: 1,
          gameCode: 'G1',
          team: `Time ${code}`,
          status,
          number: `#${code}`,
          athletes: {
            create: [{ code: 1, name: `Atleta ${code}`, cpf: `${code}00000000`, phonenumber: `1198${code}000`, category: 1 }],
          },
        },
      });
    }
    const base = { game: 'G1', category: 1, judge: 'Juiz', scoreStatus: 'approved_by_head_judge' };
    await ctx.prisma.score.create({ data: { ...base, idEvent: 1, codeTeam: 101, time: '05:00' } });
    await ctx.prisma.score.create({ data: { ...base, idEvent: 1, codeTeam: 102, time: '06:00' } });
    await ctx.prisma.score.create({ data: { ...base, idEvent: 1, codeTeam: 103, time: '04:00' } });
    // a equipe 103 é cancelada depois de pontuar
    await ctx.prisma.registration.update({
      where: { code_gameCode: { code: 103, gameCode: 'G1' } },
      data: { status: 'cancelled' },
    });
  });

  it('é público e devolve a equipe cancelada com status cancelled, sem dados pessoais', async () => {
    const res = await http().get('/events/G1/board').expect(200);
    expect(res.body.game.code).toBe('G1');
    expect(res.body.game.rule.mode).toBeDefined();
    const rx = res.body.categories.find((c: any) => c.id === 1);
    const cancelada = rx.rows.find((r: any) => r.teamCode === 103);
    expect(cancelada.status).toBe('cancelled');
    expect(rx.rows.find((r: any) => r.teamCode === 101).status).toBe('active');

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('10100000000');
    expect(body).not.toContain('1198101000');
    expect(body).not.toContain('@t.com');
    expect(body).toContain('Atleta 101');
  });

  it('campeonato em rascunho: 404 para anônimo, 200 para organizador vinculado', async () => {
    await ctx.prisma.game.update({ where: { code: 'G1' }, data: { status: 'draft' } });
    await http().get('/events/G1/board').expect(404);
    await http().get('/events/G1/board').set(bearer(tA)).expect(200);
  });

  it('campeonato inexistente retorna 404', async () => {
    await http().get('/events/NAOEXISTE/board').expect(404);
  });

  it('websocket recebe novo board após lançar um score', async () => {
    const port = (ctx.app.getHttpServer().address() as AddressInfo).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/leaderboard?game=G1`);
    const messages: any[] = [];
    const next = (n: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout aguardando board')), 8000);
        const check = () => {
          if (messages.length >= n) {
            clearTimeout(timer);
            resolve();
          }
        };
        ws.on('message', check);
        check();
      });
    ws.on('message', (data) => messages.push(JSON.parse(data.toString())));

    try {
      await next(1);
      expect(messages[0].type).toBe('board');
      expect(messages[0].board.game.code).toBe('G1');

      await http()
        .post('/scores')
        .set(bearer(tA))
        .send({ idEvent: 2, game: 'G1', category: 1, codeTeam: 101, time: '03:30', judge: 'Juiz' })
        .expect(201);

      await next(2);
      expect(messages[1].type).toBe('board');
      const rx = messages[1].board.categories.find((c: any) => c.id === 1);
      expect(rx.rows.find((r: any) => r.teamCode === 101).wods[1].status).toBe('scored');
    } finally {
      ws.close();
    }
  });
});
