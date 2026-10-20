import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../../common/enums/role.enum';
import { LeaderboardNotifier } from '../leaderboard/leaderboard-notifier.service';
import { BoardService } from '../scoring/board.service';
import { Board } from '../scoring/types';
import { WsUpgradeRouter } from '../ws/ws-upgrade-router';
import { ScreenNotifier } from './screen-notifier.service';
import { buildScreenMessage, ScreenRecord } from './screen-message';
import { effectiveGameCodes, ScreenMode } from './screens-logic';
import { hashDeviceToken } from './screen-token';

const PATH = '/ws/screen';
const DEBOUNCE_MS = 300;
const PING_MS = 25_000;
const SEEN_MS = 30_000;

// Estado em memória de cada telão com ao menos um aparelho conectado.
interface Live {
  sockets: Set<WebSocket>;
  codes: Set<string>; // campeonatos configurados (para reagir a mudanças de vínculo/status)
  frozen: boolean;
  seq: number; // descarta cálculos atrasados quando chega um mais novo
  timer?: NodeJS.Timeout;
}

// Websocket dos telões: ws://host/ws/screen?token=<credencial do aparelho>.
// A credencial nunca é logada. Telão congelado serve só a cópia gravada (frozenBoards).
@Injectable()
export class ScreenStreamService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('ScreenStream');
  private wss?: WebSocketServer;
  private pingTimer?: NodeJS.Timeout;
  private seenTimer?: NodeJS.Timeout;
  private readonly live = new Map<string, Live>();

  constructor(
    private readonly router: WsUpgradeRouter,
    private readonly prisma: PrismaService,
    private readonly boards: BoardService,
    screens: ScreenNotifier,
    leaderboard: LeaderboardNotifier,
  ) {
    leaderboard.onChange((game) => this.onBoardChange(game));
    screens.onChange((id, kind) => (kind === 'removed' ? this.remove(id) : this.schedule(id, 0)));
    screens.onGameChange((game) => this.onGameChange(game));
  }

  onApplicationBootstrap() {
    this.wss = new WebSocketServer({ noServer: true });
    this.router.register(PATH, this.wss);
    this.wss.on('connection', (socket, request) => {
      const token = new URL(request.url || '', 'http://localhost').searchParams.get('token') || '';
      void this.attach(socket, token);
    });
    this.pingTimer = setInterval(() => this.ping(), PING_MS);
    this.seenTimer = setInterval(() => void this.touchAll(), SEEN_MS);
  }

  onApplicationShutdown() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.seenTimer) clearInterval(this.seenTimer);
    this.live.forEach((l) => l.timer && clearTimeout(l.timer));
    this.wss?.close();
  }

  private async attach(socket: WebSocket, token: string) {
    socket.on('error', () => socket.terminate());
    let id: string;
    try {
      const row = token
        ? await this.prisma.screen.findUnique({
            where: { deviceTokenHash: hashDeviceToken(token) },
            select: { id: true },
          })
        : null;
      if (!row) {
        socket.close(4401, 'Credencial inválida');
        return;
      }
      id = row.id;
    } catch (e) {
      this.log.warn(`Falha ao validar telão: ${(e as Error).message}`);
      socket.close(1011, 'Erro interno');
      return;
    }
    const entry = this.live.get(id) ?? { sockets: new Set(), codes: new Set(), frozen: false, seq: 0 };
    entry.sockets.add(socket);
    this.live.set(id, entry);
    socket.on('close', () => {
      entry.sockets.delete(socket);
      if (!entry.sockets.size) {
        if (entry.timer) clearTimeout(entry.timer);
        if (this.live.get(id) === entry) this.live.delete(id);
      }
      void this.touch(id);
    });
    void this.touch(id);
    await this.send(id, socket);
  }

  private remove(id: string) {
    const entry = this.live.get(id);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    this.live.delete(id);
    entry.sockets.forEach((s) => s.close(4410, 'Telão removido'));
  }

  // Agrupa rajadas num único envio por telão.
  private schedule(id: string, delay: number) {
    const entry = this.live.get(id);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      void this.send(id);
    }, delay);
  }

  private onBoardChange(game: string) {
    this.live.forEach((entry, id) => {
      // Congelado nunca recebe dado novo
      if (!entry.frozen && entry.codes.has(game)) this.schedule(id, DEBOUNCE_MS);
    });
  }

  private onGameChange(game: string) {
    this.live.forEach((entry, id) => {
      if (entry.codes.has(game)) this.schedule(id, 0);
    });
  }

  // Calcula e envia a mensagem do telão (a um socket ou a todos).
  private async send(id: string, only?: WebSocket) {
    const entry = this.live.get(id);
    if (!entry) return;
    const seq = ++entry.seq;
    try {
      const row = await this.prisma.screen.findUnique({
        where: { id },
        include: { games: { select: { gameCode: true } } },
      });
      if (!row) {
        this.remove(id);
        return;
      }
      const configured = row.games.map((g) => g.gameCode);
      const frozen = row.frozen;
      let live: Board[] = [];
      if (!frozen) live = await this.liveBoards(row.ownerId, configured);
      // Chegou um cálculo mais novo (ou o telão saiu): este resultado é descartado
      if (seq !== entry.seq || this.live.get(id) !== entry) return;
      entry.codes = new Set(configured);
      entry.frozen = frozen;
      const record: ScreenRecord = {
        id: row.id,
        name: row.name,
        mode: row.mode as ScreenMode,
        rotateSeconds: row.rotateSeconds,
        frozen,
        frozenAt: row.frozenAt,
        overlayText: row.overlayText,
        frozenBoards: frozen ? this.frozenList(row.frozenBoards) : null,
      };
      const payload = JSON.stringify(buildScreenMessage(record, live));
      const targets = only ? [only] : [...entry.sockets];
      targets.forEach((s) => s.readyState === WebSocket.OPEN && s.send(payload));
    } catch (e) {
      this.log.warn(`Falha ao enviar telão ${id}: ${(e as Error).message}`);
    }
  }

  private frozenList(value: unknown): Board[] {
    if (Array.isArray(value)) return value as Board[];
    if (value && typeof value === 'object') return Object.values(value as Record<string, Board>);
    return [];
  }

  // Campeonatos efetivos com o dono ATUAL: super admin vê tudo; organizador só vínculos ativos.
  private async liveBoards(ownerId: string | null, configured: string[]): Promise<Board[]> {
    if (!ownerId || !configured.length) return [];
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { role: true } });
    if (!owner) return [];
    const games = await this.prisma.game.findMany({
      where: { code: { in: configured } },
      select: { code: true, status: true },
    });
    const existing = new Set(games.map((g) => g.code));
    const blocked = new Set(games.filter((g) => g.status === 'blocked').map((g) => g.code));
    let manageable: Set<string> | 'all';
    if (owner.role === UserRole.SUPER_ADMIN) {
      manageable = 'all';
    } else if (owner.role === UserRole.ORGANIZER) {
      const links = await this.prisma.gameOrganizer.findMany({
        where: { userId: ownerId, active: true, gameCode: { in: configured } },
        select: { gameCode: true },
      });
      manageable = new Set(links.map((l) => l.gameCode));
    } else {
      return [];
    }
    const codes = effectiveGameCodes(
      configured.filter((c) => existing.has(c)),
      manageable,
      blocked,
    );
    const out: Board[] = [];
    for (const code of codes) {
      try {
        out.push(await this.boards.loadBoard(code));
      } catch {
        // campeonato sumiu entre a consulta e o cálculo: fica de fora
      }
    }
    return out;
  }

  private async touch(id: string) {
    try {
      await this.prisma.screen.update({ where: { id }, data: { lastSeenAt: new Date() } });
    } catch {
      // telão removido: nada a atualizar
    }
  }

  private async touchAll() {
    for (const id of [...this.live.keys()]) await this.touch(id);
  }

  private ping() {
    this.wss?.clients.forEach((s) => s.readyState === WebSocket.OPEN && s.ping());
  }
}
