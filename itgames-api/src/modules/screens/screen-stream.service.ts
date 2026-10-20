import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaderboardNotifier } from '../leaderboard/leaderboard-notifier.service';
import { BoardService } from '../scoring/board.service';
import { Board } from '../scoring/types';
import { WsUpgradeRouter } from '../ws/ws-upgrade-router';
import { ScreenNotifier } from './screen-notifier.service';
import { buildScreenMessage, ScreenRecord } from './screen-message';
import { effectiveCodesForOwner } from './owner-codes';
import { ScreenMode } from './screens-logic';
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
  // true quando o aparelho respondeu (pong) ao último ping; quem não responde é derrubado no ping seguinte
  private readonly alive = new WeakMap<WebSocket, boolean>();
  private readonly lastPong = new WeakMap<WebSocket, number>(); // instante do último sinal de vida

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
    this.alive.set(socket, true);
    this.lastPong.set(socket, Date.now());
    socket.on('pong', () => {
      this.alive.set(socket, true);
      this.lastPong.set(socket, Date.now());
    });
    // O 'close' é ouvido antes de qualquer await: socket que fecha durante a consulta não vaza
    let id: string | undefined;
    let entry: Live | undefined;
    socket.on('close', () => {
      if (!id || !entry) return;
      entry.sockets.delete(socket);
      if (!entry.sockets.size) {
        if (entry.timer) clearTimeout(entry.timer);
        if (this.live.get(id) === entry) this.live.delete(id);
      }
      void this.touch(id);
    });
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
    if (socket.readyState !== WebSocket.OPEN) return; // aparelho já foi embora
    entry = this.live.get(id) ?? { sockets: new Set(), codes: new Set(), frozen: false, seq: 0 };
    entry.sockets.add(socket);
    this.live.set(id, entry);
    // Define os campeonatos antes do unicast: um placar que chegue durante o primeiro cálculo já é empurrado
    if (!entry.codes.size) entry.codes = await this.configuredCodes(id);
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
    // Invalida já cálculos em andamento (ex.: um ao vivo iniciado antes de um congelamento)
    entry.seq++;
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
    // Envio a todos invalida cálculos anteriores; o unicast (conexão nova) não derruba um
    // broadcast em andamento, mas é descartado se um broadcast começar durante o cálculo
    // (esse broadcast já alcança o socket, que está em entry.sockets).
    const seq = only ? entry.seq : ++entry.seq;
    try {
      const row = await this.prisma.screen.findUnique({
        where: { id },
        include: { games: { select: { gameCode: true } } },
      });
      if (!row) {
        this.remove(id);
        return;
      }
      const configured = row.games.map((g) => g.gameCode).sort();
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

  // Campeonatos efetivos com o dono ATUAL (lógica compartilhada com o congelamento).
  private async liveBoards(ownerId: string | null, configured: string[]): Promise<Board[]> {
    const codes = await effectiveCodesForOwner(this.prisma, ownerId, configured);
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

  // Campeonatos configurados no telão (vazio se a consulta falhar; o send() corrige em seguida).
  private async configuredCodes(id: string): Promise<Set<string>> {
    try {
      const rows = await this.prisma.screenGame.findMany({ where: { screenId: id }, select: { gameCode: true } });
      return new Set(rows.map((r) => r.gameCode));
    } catch {
      return new Set();
    }
  }

  // Só telões com algum socket vivo (que respondeu ao ping) têm o lastSeenAt renovado.
  private async touchAll() {
    for (const [id, entry] of [...this.live]) {
      const now = Date.now();
      const vivo = [...entry.sockets].some(
        (s) => s.readyState === WebSocket.OPEN && now - (this.lastPong.get(s) ?? 0) <= PING_MS + 10_000,
      );
      if (vivo) await this.touch(id);
    }
  }

  // Quem não respondeu ao ping anterior está morto: derruba; os demais recebem novo ping.
  private ping() {
    this.wss?.clients.forEach((s) => {
      if (s.readyState !== WebSocket.OPEN) return;
      if (this.alive.get(s) === false) {
        s.terminate();
        return;
      }
      this.alive.set(s, false);
      s.ping();
    });
  }
}
