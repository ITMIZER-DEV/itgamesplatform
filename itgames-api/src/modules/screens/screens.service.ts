import { BadRequestException, GoneException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { GameAccessService } from '../../common/access/game-access.service';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardService } from '../scoring/board.service';
import { Board } from '../scoring/types';
import { AttemptLimiter } from './attempt-limiter';
import { ClaimScreenDto, UpdateScreenDto } from './dto/screens.dto';
import { generateDeviceToken, hashDeviceToken } from './screen-token';
import { ScreenNotifier } from './screen-notifier.service';
import {
  GameForScreen,
  PAIRING_TTL_MS,
  ScreenMode,
  canControlScreen,
  clampRotateSeconds,
  effectiveGameCodes,
  generatePairingCode,
  isPairingExpired,
  normalizePairingCode,
  parseOverlayText,
  parseScreenMode,
  validateScreenGames,
} from './screens-logic';

export interface ScreenView {
  id: string;
  name: string;
  mode: ScreenMode;
  rotateSeconds: number;
  frozen: boolean;
  frozenAt: string | null;
  overlayText: string | null;
  gameCodes: string[];
  online: boolean;
  lastSeenAt: string | null;
  ownerId: string | null;
}

export type PairingPoll = { status: 'pending' | 'expired' } | { status: 'paired'; deviceToken: string };

const ONLINE_WINDOW_MS = 45_000;
const PURGE_AFTER_MS = 3_600_000;
const OFFICIAL_MSG = 'Modo oficial disponível após o cálculo oficial do juiz-chefe';

type ScreenRow = Prisma.ScreenGetPayload<{ include: { games: true } }>;

@Injectable()
export class ScreensService {
  // Em memória: reiniciar a API zera as janelas (aceitável, como o RateLimiter existente).
  private readonly pairingByIp = new AttemptLimiter(10, 60_000);
  private readonly claimByUser = new AttemptLimiter(10, 600_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GameAccessService,
    private readonly boards: BoardService,
    private readonly notifier: ScreenNotifier,
  ) {}

  // ---------- pareamento (público) ----------

  async createPairing(ip: string): Promise<{ pairingId: string; code: string; expiresAt: string }> {
    const now = new Date();
    if (!this.pairingByIp.hit(ip, now.getTime())) {
      throw new HttpException('Muitos pedidos de código. Tente novamente em instantes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    // Limpa telões nunca resgatados cujo código expirou há mais de 1 hora.
    await this.prisma.screen.deleteMany({
      where: { claimedAt: null, ownerId: null, pairingExpiresAt: { lt: new Date(now.getTime() - PURGE_AFTER_MS) } },
    });

    const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generatePairingCode((max) => randomInt(max));
      try {
        const screen = await this.prisma.screen.create({
          data: { name: 'Novo telão', pairingCode: code, pairingExpiresAt: expiresAt },
        });
        return { pairingId: screen.id, code, expiresAt: expiresAt.toISOString() };
      } catch (e) {
        // Colisão do código único: sorteia outro.
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
    }
    throw new HttpException('Não foi possível gerar o código. Tente novamente.', HttpStatus.SERVICE_UNAVAILABLE);
  }

  async pollPairing(pairingId: string): Promise<PairingPoll> {
    const screen = await this.prisma.screen.findUnique({ where: { id: pairingId } });
    if (!screen) throw new NotFoundException('Pareamento não encontrado');

    if (!screen.claimedAt) {
      const expired = !screen.pairingExpiresAt || isPairingExpired(screen.pairingExpiresAt, new Date());
      return { status: expired ? 'expired' : 'pending' };
    }
    if (screen.deviceTokenHash) throw new GoneException('Credencial já entregue');

    // A credencial é entregue uma única vez; só o hash fica no banco (nunca registrada em log).
    const deviceToken = generateDeviceToken();
    const won = await this.prisma.screen.updateMany({
      where: { id: pairingId, deviceTokenHash: null, claimedAt: { not: null } },
      data: { deviceTokenHash: hashDeviceToken(deviceToken) },
    });
    if (won.count !== 1) throw new GoneException('Credencial já entregue');
    return { status: 'paired', deviceToken };
  }

  // ---------- resgate e CRUD (organizador) ----------

  async claim(user: AuthUser, dto: ClaimScreenDto): Promise<ScreenView> {
    // Só tentativas inválidas (404 genérico) consomem cota; claims válidos e 400 não.
    if (this.claimByUser.isBlocked(user.id, Date.now())) {
      throw new HttpException('Muitas tentativas. Aguarde alguns minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const notFound = () => {
      this.claimByUser.hit(user.id, Date.now());
      return new NotFoundException('Código inválido ou expirado');
    };
    const code = normalizePairingCode(dto.code);
    if (!code) throw notFound();

    const pending = await this.prisma.screen.findUnique({ where: { pairingCode: code } });
    if (
      !pending ||
      pending.claimedAt ||
      pending.ownerId ||
      !pending.pairingExpiresAt ||
      isPairingExpired(pending.pairingExpiresAt, new Date())
    ) {
      throw notFound();
    }

    const mode = this.parseMode(dto.mode);
    const rotateSeconds = this.parseRotate(dto.rotateSeconds) ?? clampRotateSeconds(undefined);
    const gameCodes = [...new Set(dto.gameCodes)];
    await this.assertGames(user, gameCodes);

    await this.prisma.$transaction(async (tx) => {
      // Resgate atômico: só um usuário consegue virar dono do código.
      const won = await tx.screen.updateMany({
        where: { id: pending.id, claimedAt: null, ownerId: null },
        data: {
          ownerId: user.id,
          name: dto.name,
          mode,
          rotateSeconds,
          claimedAt: new Date(),
          pairingCode: null,
          pairingExpiresAt: null,
        },
      });
      if (won.count !== 1) throw notFound();
      await tx.screenGame.createMany({ data: gameCodes.map((gameCode) => ({ screenId: pending.id, gameCode })) });
    });

    const screen = await this.mustFind(pending.id);
    await this.log(screen, 'claim', user);
    this.notifier.changed(screen.id);
    return this.toView(screen);
  }

  async list(user: AuthUser): Promise<ScreenView[]> {
    return (await this.controlledScreens(user)).map((r) => this.toView(r));
  }

  async update(user: AuthUser, id: string, dto: UpdateScreenDto): Promise<ScreenView> {
    const screen = await this.getControlled(user, id);
    const data: Prisma.ScreenUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.mode !== undefined) data.mode = this.parseMode(dto.mode);
    const rotate = this.parseRotate(dto.rotateSeconds);
    if (rotate !== undefined) data.rotateSeconds = rotate;

    let gameCodes: string[] | null = null;
    if (dto.gameCodes !== undefined) {
      gameCodes = [...new Set(dto.gameCodes)];
      await this.assertGames(user, gameCodes);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.screen.update({ where: { id }, data });
      if (gameCodes) {
        await tx.screenGame.deleteMany({ where: { screenId: id } });
        await tx.screenGame.createMany({ data: gameCodes.map((gameCode) => ({ screenId: id, gameCode })) });
      }
    });

    const updated = await this.mustFind(screen.id);
    await this.log(updated, 'update', user);
    this.notifier.changed(id);
    return this.toView(updated);
  }

  async freeze(user: AuthUser, id: string, text?: unknown): Promise<ScreenView> {
    const screen = await this.getControlled(user, id);
    return this.freezeScreen(user, screen, this.overlayOrThrow(text));
  }

  async unfreeze(user: AuthUser, id: string): Promise<ScreenView> {
    const screen = await this.getControlled(user, id);
    return this.unfreezeScreen(user, screen);
  }

  async freezeAll(user: AuthUser, text?: unknown): Promise<ScreenView[]> {
    const overlay = this.overlayOrThrow(text);
    const out: ScreenView[] = [];
    for (const screen of await this.controlledScreens(user)) out.push(await this.freezeScreen(user, screen, overlay));
    return out;
  }

  async unfreezeAll(user: AuthUser): Promise<ScreenView[]> {
    const out: ScreenView[] = [];
    for (const screen of await this.controlledScreens(user)) out.push(await this.unfreezeScreen(user, screen));
    return out;
  }

  async remove(user: AuthUser, id: string): Promise<{ ok: true }> {
    const screen = await this.getControlled(user, id);
    await this.prisma.screen.delete({ where: { id } });
    await this.log(screen, 'delete', user);
    this.notifier.removed(id);
    return { ok: true };
  }

  // ---------- internos ----------

  private overlayOrThrow(text: unknown): string {
    if (text !== undefined && text !== null && typeof text !== 'string') {
      throw new BadRequestException('Texto do aviso deve ser um texto');
    }
    const overlay = parseOverlayText(text);
    if (overlay === null) throw new BadRequestException('Texto do aviso deve ter no máximo 60 caracteres');
    return overlay;
  }

  private async freezeScreen(user: AuthUser, screen: ScreenRow, overlayText: string): Promise<ScreenView> {
    const codes = await this.effectiveCodes(user, screen);
    const frozenBoards: Record<string, Board> = {};
    for (const code of codes) frozenBoards[code] = await this.boards.loadBoard(code);

    await this.prisma.screen.update({
      where: { id: screen.id },
      data: {
        frozen: true,
        frozenAt: new Date(),
        overlayText,
        frozenBoards: frozenBoards as unknown as Prisma.InputJsonValue,
      },
    });
    const updated = await this.mustFind(screen.id);
    await this.log(updated, 'freeze', user);
    this.notifier.changed(screen.id);
    return this.toView(updated);
  }

  private async unfreezeScreen(user: AuthUser, screen: ScreenRow): Promise<ScreenView> {
    await this.prisma.screen.update({
      where: { id: screen.id },
      data: { frozen: false, frozenAt: null, overlayText: null, frozenBoards: Prisma.DbNull },
    });
    const updated = await this.mustFind(screen.id);
    await this.log(updated, 'unfreeze', user);
    this.notifier.changed(screen.id);
    return this.toView(updated);
  }

  // Campeonatos que o telão de fato exibe agora (gerenciáveis e não bloqueados).
  private async effectiveCodes(user: AuthUser, screen: ScreenRow): Promise<string[]> {
    const codes = screen.games.map((g) => g.gameCode);
    const games = await this.prisma.game.findMany({
      where: { code: { in: codes } },
      select: { code: true, status: true },
    });
    const existing = new Set(games.map((g) => g.code));
    const blocked = new Set(games.filter((g) => g.status === 'blocked').map((g) => g.code));
    let manageable: Set<string> | 'all' = 'all';
    if (user.role !== UserRole.SUPER_ADMIN) {
      manageable = new Set<string>();
      for (const c of codes) if (await this.access.canManage(user, c)) manageable.add(c);
    }
    return effectiveGameCodes(
      codes.filter((c) => existing.has(c)),
      manageable,
      blocked,
    );
  }

  private async assertGames(user: AuthUser, codes: string[]): Promise<void> {
    const games = await this.prisma.game.findMany({
      where: { code: { in: codes } },
      select: { code: true, status: true },
    });
    const known = new Map<string, GameForScreen>();
    for (const g of games) {
      known.set(g.code, { code: g.code, status: g.status, canManage: await this.access.canManage(user, g.code) });
    }
    const error = validateScreenGames(codes, known, user.role === UserRole.SUPER_ADMIN);
    if (error) throw new BadRequestException(error);
  }

  private parseMode(input: unknown): ScreenMode {
    if (input === undefined || input === null) return 'partial';
    const mode = parseScreenMode(input);
    if (!mode) throw new BadRequestException('Modo inválido');
    if (mode === 'official') throw new BadRequestException(OFFICIAL_MSG);
    return mode;
  }

  // Converte para número antes do clamp (clampRotateSeconds("30") devolveria o padrão).
  private parseRotate(input: unknown): number | undefined {
    if (input === undefined || input === null || input === '') return undefined;
    const n = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : NaN;
    if (!Number.isFinite(n)) throw new BadRequestException('Tempo de rotação inválido');
    return clampRotateSeconds(n);
  }

  private async mustFind(id: string): Promise<ScreenRow> {
    const screen = await this.prisma.screen.findUnique({ where: { id }, include: { games: true } });
    if (!screen) throw new NotFoundException('Telão não encontrado');
    return screen;
  }

  // 404 (nunca 403) para quem não controla o telão; pendentes não resgatados também não existem aqui.
  private async getControlled(user: AuthUser, id: string): Promise<ScreenRow> {
    const screen = await this.prisma.screen.findUnique({ where: { id }, include: { games: true } });
    if (!screen || !screen.claimedAt || !canControlScreen(user, screen)) {
      throw new NotFoundException('Telão não encontrado');
    }
    return screen;
  }

  private controlledScreens(user: AuthUser): Promise<ScreenRow[]> {
    return this.prisma.screen.findMany({
      where: { claimedAt: { not: null }, ...(user.role === UserRole.SUPER_ADMIN ? {} : { ownerId: user.id }) },
      include: { games: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async log(screen: { id: string; name: string }, action: string, user: AuthUser): Promise<void> {
    await this.prisma.screenLog.create({
      data: { screenId: screen.id, screenName: screen.name, action, userId: user.id, userName: user.name },
    });
  }

  toView(s: ScreenRow): ScreenView {
    return {
      id: s.id,
      name: s.name,
      mode: parseScreenMode(s.mode) ?? 'partial',
      rotateSeconds: s.rotateSeconds,
      frozen: s.frozen,
      frozenAt: s.frozenAt ? s.frozenAt.toISOString() : null,
      overlayText: s.overlayText,
      gameCodes: s.games.map((g) => g.gameCode).sort(),
      online: !!s.lastSeenAt && Date.now() - s.lastSeenAt.getTime() <= ONLINE_WINDOW_MS,
      lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null,
      ownerId: s.ownerId,
    };
  }
}
