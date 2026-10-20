import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { BoardService } from '../scoring/board.service';
import { Board } from '../scoring/types';
import { WsUpgradeRouter } from '../ws/ws-upgrade-router';
import { LeaderboardNotifier } from './leaderboard-notifier.service';

const PATH = '/ws/leaderboard';
const DEBOUNCE_MS = 300;
const PING_MS = 25_000;

// Websocket do telão: ws://host/ws/leaderboard?game=CODIGO
// Envia {type:'board', board} ao conectar e a cada alteração de placar do campeonato.
@Injectable()
export class LeaderboardStreamService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('LeaderboardStream');
  private wss?: WebSocketServer;
  private pingTimer?: NodeJS.Timeout;
  private readonly clients = new Map<string, Set<WebSocket>>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly router: WsUpgradeRouter,
    private readonly boards: BoardService,
    notifier: LeaderboardNotifier,
  ) {
    notifier.onChange((game) => this.notify(game));
  }

  onApplicationBootstrap() {
    this.wss = new WebSocketServer({ noServer: true });
    this.router.register(PATH, this.wss);
    this.wss.on('connection', (socket, request) => {
      const game = new URL(request.url || '', 'http://localhost').searchParams.get('game') || '';
      void this.attach(socket, game);
    });
    this.pingTimer = setInterval(() => this.ping(), PING_MS);
  }

  onApplicationShutdown() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.timers.forEach((t) => clearTimeout(t));
    this.wss?.close();
  }

  // Avisa que o placar do campeonato mudou; agrupa rajadas de lançamentos em um único envio.
  notify(game: string) {
    if (!this.clients.get(game)?.size) return;
    clearTimeout(this.timers.get(game));
    this.timers.set(
      game,
      setTimeout(() => {
        this.timers.delete(game);
        void this.broadcast(game);
      }, DEBOUNCE_MS),
    );
  }

  private async board(game: string): Promise<Board> {
    // Mesma regra de visibilidade do REST público: campeonato fora do ar vira 404
    return this.boards.getBoard(game, undefined);
  }

  private async attach(socket: WebSocket, game: string) {
    try {
      const board = await this.board(game);
      const set = this.clients.get(game) ?? new Set<WebSocket>();
      set.add(socket);
      this.clients.set(game, set);
      socket.on('close', () => {
        set.delete(socket);
        if (!set.size) this.clients.delete(game);
      });
      socket.on('error', () => socket.terminate());
      socket.send(JSON.stringify({ type: 'board', board }));
    } catch {
      socket.close(4404, 'Campeonato não encontrado');
    }
  }

  private async broadcast(game: string) {
    const set = this.clients.get(game);
    if (!set?.size) return;
    try {
      const payload = JSON.stringify({ type: 'board', board: await this.board(game) });
      set.forEach((s) => s.readyState === WebSocket.OPEN && s.send(payload));
    } catch (e) {
      this.log.warn(`Falha ao enviar placar de ${game}: ${(e as Error).message}`);
      set.forEach((s) => s.close(4404, 'Campeonato indisponível'));
    }
  }

  private ping() {
    this.wss?.clients.forEach((s) => s.readyState === WebSocket.OPEN && s.ping());
  }
}
