import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import type { WebSocketServer } from 'ws';

// Um único handler 'upgrade' no servidor HTTP, roteando por pathname. Vários WebSocketServer
// com { server, path } no mesmo servidor recusam os upgrades uns dos outros; por isso todos
// usam noServer e se registram aqui. Caminho desconhecido: 404 e socket destruído.
@Injectable()
export class WsUpgradeRouter implements OnApplicationBootstrap {
  private readonly routes = new Map<string, WebSocketServer>();
  private attached?: { server: Server; handler: (...a: never[]) => void };

  constructor(private readonly httpAdapterHost?: HttpAdapterHost) {}

  register(path: string, wss: WebSocketServer): void {
    this.routes.set(path, wss);
  }

  onApplicationBootstrap() {
    const server = this.httpAdapterHost?.httpAdapter?.getHttpServer();
    if (server) this.attach(server);
  }

  attach(server: Server): void {
    if (this.attached) return;
    const handler = (req: IncomingMessage, socket: Duplex, head: Buffer) => this.route(req, socket, head);
    server.on('upgrade', handler);
    this.attached = { server, handler: handler as never };
  }

  detach(): void {
    if (this.attached) this.attached.server.off('upgrade', this.attached.handler as never);
    this.attached = undefined;
  }

  private route(req: IncomingMessage, socket: Duplex, head: Buffer) {
    let pathname = '';
    try {
      pathname = new URL(req.url || '', 'http://localhost').pathname;
    } catch {
      /* URL inválida cai no 404 */
    }
    const wss = this.routes.get(pathname);
    if (!wss) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  }
}
