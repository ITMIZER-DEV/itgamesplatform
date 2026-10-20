import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { WebSocket, WebSocketServer } from 'ws';
import { WsUpgradeRouter } from '../../src/modules/ws/ws-upgrade-router';

describe('WsUpgradeRouter', () => {
  let server: Server;
  let router: WsUpgradeRouter;
  let port: number;
  const wssA = new WebSocketServer({ noServer: true });
  const wssB = new WebSocketServer({ noServer: true });

  beforeAll(async () => {
    wssA.on('connection', (s) => s.send('A'));
    wssB.on('connection', (s) => s.send('B'));
    server = createServer();
    router = new WsUpgradeRouter();
    router.register('/ws/a', wssA);
    router.register('/ws/b', wssB);
    router.attach(server);
    await new Promise<void>((r) => server.listen(0, r));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    router.detach();
    wssA.close();
    wssB.close();
    await new Promise((r) => server.close(r));
  });

  const first = (url: string) =>
    new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.on('message', (m) => {
        resolve(String(m));
        ws.close();
      });
      ws.on('error', reject);
    });

  it('encaminha cada caminho ao seu servidor, ignorando a query string', async () => {
    expect(await first(`ws://127.0.0.1:${port}/ws/a?game=X`)).toBe('A');
    expect(await first(`ws://127.0.0.1:${port}/ws/b?token=Y`)).toBe('B');
  });

  it('caminho desconhecido recebe 404 e o socket é destruído', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/nada`);
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      ws.on('error', () => reject(new Error('sem resposta 404')));
    });
    expect(status).toBe(404);
  });
});
