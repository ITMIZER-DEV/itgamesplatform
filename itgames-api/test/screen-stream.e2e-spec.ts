// Compila, mas não é executado neste ambiente (depende do banco real).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import request from 'supertest';
import { WebSocket } from 'ws';
import { AppModule } from '../src/app.module';

type Msg = { type: string; screen?: { frozen: boolean; games: { code: string }[] }; board?: unknown };

function open(url: string) {
  const ws = new WebSocket(url);
  const inbox: Msg[] = [];
  const waiters: ((m: Msg) => void)[] = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw)) as Msg;
    const w = waiters.shift();
    if (w) w(m);
    else inbox.push(m);
  });
  const next = (ms = 3000) =>
    new Promise<Msg>((resolve, reject) => {
      const queued = inbox.shift();
      if (queued) return resolve(queued);
      const t = setTimeout(() => reject(new Error('timeout')), ms);
      waiters.push((m) => {
        clearTimeout(t);
        resolve(m);
      });
    });
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
  return { ws, next, closed };
}

describe('Websocket dos telões (e2e)', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.listen(0);
    base = `ws://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('token inválido fecha com 4401', async () => {
    const c = open(`${base}/ws/screen?token=inexistente`);
    expect(await c.closed).toBe(4401);
  });

  it('caminho desconhecido não é aceito', async () => {
    const status = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`${base}/ws/outro`);
      ws.on('unexpected-response', (_r, res) => resolve(res.statusCode ?? 0));
      ws.on('error', () => resolve(0));
    });
    expect(status).toBe(404);
  });

  it('o websocket antigo /ws/leaderboard?game= continua respondendo', async () => {
    const c = open(`${base}/ws/leaderboard?game=NAO_EXISTE`);
    expect(await c.closed).toBe(4404);
  });

  // Fluxo completo (precisa de dados semeados: telão pareado, lançamento de score, DELETE):
  // 1. conecta com o token do aparelho e recebe { type: 'screen' };
  // 2. lança score em campeonato do telão -> novo 'screen' só quando NÃO congelado;
  // 3. DELETE /screens/:id fecha o websocket com 4410.
  it('GET /events/:code/board segue público e inalterado', async () => {
    await request(app.getHttpServer()).get('/events/NAO_EXISTE/board').expect(404);
  });
});
