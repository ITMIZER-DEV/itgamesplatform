// Compila, mas não é executado neste ambiente (depende do banco real itgames_test).
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

interface Msg {
  type: string;
  screen: { id: string; frozen: boolean; games: { code: string }[] };
  boards: { game: { code: string }; categories: { rows: unknown[] }[] }[];
}

// Cliente simples: guarda as mensagens e permite aguardar a n-ésima.
function connect(url: string) {
  const ws = new WebSocket(url);
  const messages: Msg[] = [];
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
  ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
  const waitFor = (n: number, ms = 8000) =>
    new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (messages.length >= n) return resolve();
        if (Date.now() - started > ms) return reject(new Error(`timeout aguardando mensagem ${n}`));
        setTimeout(tick, 25);
      };
      tick();
    });
  return { ws, messages, closed, waitFor };
}

describe('Websocket dos telões (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let tA: string;
  let base: string;
  const http = () => request(ctx.app.getHttpServer());

  // Pareia um telão com G1 e devolve id + credencial do aparelho.
  async function pairScreen() {
    const p = await http().post('/screens/pairing').expect(201);
    const claim = await http()
      .post('/screens/claim')
      .set(bearer(tA))
      .send({ code: p.body.code, name: 'Telão 1', gameCodes: ['G1'] })
      .expect(201);
    const poll = await http().get(`/screens/pairing/${p.body.pairingId}`).expect(200);
    return { id: claim.body.id as string, token: poll.body.deviceToken as string };
  }

  const lancarScore = (idEvent: number, codeTeam: number, time: string) =>
    http()
      .post('/scores')
      .set(bearer(tA))
      .send({ idEvent, game: 'G1', category: 1, codeTeam, time, judge: 'Juiz' })
      .expect(201);

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);
    base = `ws://127.0.0.1:${(ctx.app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    orgA = await createUser(ctx.prisma, { email: 'a@t.com', role: 'ORGANIZER' });
    tA = await login(ctx.app, 'a@t.com');

    // Campeonato em rascunho: o telão pode exibi-lo, os endpoints públicos não
    await createGameFixture(ctx.prisma, 'G1', { status: 'draft', organizerIds: [orgA.id] });
    await createCategoryFixture(ctx.prisma, 'G1', 1);
    for (const code of [1, 2]) {
      await ctx.prisma.workout.create({
        data: { code, game: 'G1', category: 1, title: `WOD ${code}`, type: 'for_time', timeCap: '10:00' },
      });
      await ctx.prisma.event.create({ data: { idEvent: code, game: 'G1', category: 1, title: `WOD ${code}`, workout: code } });
    }
    for (const code of [101, 102]) {
      await ctx.prisma.registration.create({
        data: {
          code,
          categoryId: 1,
          gameCode: 'G1',
          team: `Time ${code}`,
          status: 'paid',
          number: `#${code}`,
          athletes: {
            create: [{ code: 1, name: `Atleta ${code}`, cpf: `${code}00000000`, phonenumber: `1198${code}000`, category: 1 }],
          },
        },
      });
    }
  });

  it('token válido recebe o screen ao conectar, inclusive com campeonato em rascunho', async () => {
    const { id, token } = await pairScreen();
    const c = connect(`${base}/ws/screen?token=${encodeURIComponent(token)}`);
    try {
      await c.waitFor(1);
      expect(c.messages[0].type).toBe('screen');
      expect(c.messages[0].screen.id).toBe(id);
      expect(c.messages[0].screen.frozen).toBe(false);
      expect(c.messages[0].boards.map((b) => b.game.code)).toEqual(['G1']);
      // o rascunho não vaza para o endpoint público
      await http().get('/events/G1/board').expect(404);
    } finally {
      c.ws.close();
    }
  });

  it('token inválido fecha com 4401', async () => {
    const c = connect(`${base}/ws/screen?token=inexistente`);
    expect(await c.closed).toBe(4401);
  });

  it('score novo gera novo screen só quando não congelado; congelado mantém a cópia', async () => {
    const { id, token } = await pairScreen();
    const c = connect(`${base}/ws/screen?token=${encodeURIComponent(token)}`);
    try {
      await c.waitFor(1);
      const before = JSON.stringify(c.messages[0].boards);

      await lancarScore(1, 101, '05:00');
      await c.waitFor(2);
      expect(c.messages[1].screen.frozen).toBe(false);
      expect(JSON.stringify(c.messages[1].boards)).not.toBe(before);

      // congela: chega um screen congelado com a cópia atual
      await http().post(`/screens/${id}/freeze`).set(bearer(tA)).send({}).expect(200);
      await c.waitFor(3);
      expect(c.messages[2].screen.frozen).toBe(true);
      const copia = JSON.stringify(c.messages[2].boards);

      // novo score com o telão congelado: nada novo chega
      await lancarScore(2, 102, '04:00');
      await new Promise((r) => setTimeout(r, 1000));
      expect(c.messages).toHaveLength(3);

      // reconexão também serve só a cópia
      const c2 = connect(`${base}/ws/screen?token=${encodeURIComponent(token)}`);
      try {
        await c2.waitFor(1);
        expect(c2.messages[0].screen.frozen).toBe(true);
        expect(JSON.stringify(c2.messages[0].boards)).toBe(copia);
      } finally {
        c2.ws.close();
      }
    } finally {
      c.ws.close();
    }
  });

  it('DELETE do telão fecha o websocket com 4410', async () => {
    const { id, token } = await pairScreen();
    const c = connect(`${base}/ws/screen?token=${encodeURIComponent(token)}`);
    await c.waitFor(1);
    await http().delete(`/screens/${id}`).set(bearer(tA)).expect(200);
    expect(await c.closed).toBe(4410);
  });

  it('o websocket antigo /ws/leaderboard?game= e o board público seguem com o contrato', async () => {
    await ctx.prisma.game.update({ where: { code: 'G1' }, data: { status: 'live' } });
    const c = connect(`${base}/ws/leaderboard?game=G1`);
    try {
      await c.waitFor(1);
      expect(c.messages[0].type).toBe('board');
      const res = await http().get('/events/G1/board').expect(200);
      expect(res.body.game.code).toBe('G1');
    } finally {
      c.ws.close();
    }
    const nope = connect(`${base}/ws/leaderboard?game=NAOEXISTE`);
    expect(await nope.closed).toBe(4404);
  });
});
