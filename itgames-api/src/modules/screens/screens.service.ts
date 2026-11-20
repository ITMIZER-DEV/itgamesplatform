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
import { ClaimScreenDto, FreezeScreenDto, ScreenSpotlightDto, UnfreezeScreenDto, UpdateScreenDto } from './dto/screens.dto';
import { effectiveCodesForOwner } from './owner-codes';
import {
  FrozenCategoryMeta,
  FrozenCategorySummary,
  HeatCallLane,
  HeatCallSpotlight,
  PodiumSpotlight,
  ScreenSpotlight,
  parseScreenEnvelope,
  summarizeFrozenCategories,
} from './screen-message';
import { generateDeviceToken, hashDeviceToken } from './screen-token';
import { ScreenNotifier } from './screen-notifier.service';
import {
  GameForScreen,
  PAIRING_TTL_MS,
  ScreenMode,
  canControlScreen,
  clampRotateSeconds,
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
  frozenCategories?: FrozenCategorySummary[];
  spotlight?: ScreenSpotlight | null;
}

export type PairingPoll = { status: 'pending' | 'expired' } | { status: 'paired'; deviceToken: string };

const ONLINE_WINDOW_MS = 45_000;
const PURGE_AFTER_MS = 3_600_000;
const OFFICIAL_MSG = 'Modo oficial disponível após o cálculo oficial do juiz-chefe';

type ScreenRow = Prisma.ScreenGetPayload<{ include: { games: true } }>;

interface FreezeOptions {
  text?: unknown;
  gameCode?: string;
  categoryIds?: number[];
}

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
    const t = Date.now();
    if (!this.claimByUser.hit(user.id, t)) {
      throw new HttpException('Muitas tentativas. Aguarde alguns minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
    try {
      const view = await this.claimInner(user, dto);
      this.claimByUser.release(user.id, t);
      return view;
    } catch (e) {
      if (!(e instanceof NotFoundException)) this.claimByUser.release(user.id, t);
      throw e;
    }
  }

  private async claimInner(user: AuthUser, dto: ClaimScreenDto): Promise<ScreenView> {
    const notFound = () => new NotFoundException('Código inválido ou expirado');
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

  async freeze(user: AuthUser, id: string, textOrDto?: unknown | FreezeScreenDto): Promise<ScreenView> {
    const screen = await this.getControlled(user, id);
    const opts = this.normalizeFreezeInput(textOrDto);
    const overlay = this.overlayOrThrow(opts.text);
    return this.freezeScreen(user, screen, overlay, opts.gameCode, opts.categoryIds);
  }

  async unfreeze(user: AuthUser, id: string, dto?: UnfreezeScreenDto): Promise<ScreenView> {
    const screen = await this.getControlled(user, id);
    return this.unfreezeScreen(user, screen, dto?.gameCode, dto?.categoryIds);
  }

  async freezeAll(user: AuthUser, textOrDto?: unknown | FreezeScreenDto): Promise<ScreenView[]> {
    const opts = this.normalizeFreezeInput(textOrDto);
    const overlay = this.overlayOrThrow(opts.text);
    const out: ScreenView[] = [];
    for (const screen of await this.ownScreens(user)) {
      out.push(await this.freezeScreen(user, screen, overlay, opts.gameCode, opts.categoryIds));
    }
    return out;
  }

  async unfreezeAll(user: AuthUser, dto?: UnfreezeScreenDto): Promise<ScreenView[]> {
    const out: ScreenView[] = [];
    for (const screen of await this.ownScreens(user)) {
      out.push(await this.unfreezeScreen(user, screen, dto?.gameCode, dto?.categoryIds));
    }
    return out;
  }

  async setSpotlight(
    user: AuthUser,
    dto: ScreenSpotlightDto,
  ): Promise<{ screens: ScreenView[]; spotlight: ScreenSpotlight }> {
    const spotlight = await this.buildSpotlight(dto);
    const targets = dto.screenId
      ? [await this.getControlled(user, dto.screenId)]
      : await this.controlledScreens(user);

    const out: ScreenView[] = [];
    for (const s of targets) {
      this.notifier.setSpotlight(s.id, spotlight);
      this.notifier.changed(s.id);
      out.push(this.toView(s));
    }
    return { screens: out, spotlight };
  }

  async clearSpotlight(user: AuthUser, screenId?: string): Promise<ScreenView[]> {
    const targets = screenId
      ? [await this.getControlled(user, screenId)]
      : await this.controlledScreens(user);

    const out: ScreenView[] = [];
    for (const s of targets) {
      this.notifier.setSpotlight(s.id, null);
      this.notifier.changed(s.id);
      out.push(this.toView(s));
    }
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

  private normalizeFreezeInput(input: unknown): FreezeOptions {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      const obj = input as FreezeScreenDto;
      return {
        text: obj.text,
        gameCode: typeof obj.gameCode === 'string' && obj.gameCode.trim() ? obj.gameCode.trim() : undefined,
        categoryIds: Array.isArray(obj.categoryIds)
          ? obj.categoryIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
          : undefined,
      };
    }
    return { text: input };
  }

  private overlayOrThrow(text: unknown): string {
    if (text !== undefined && text !== null && typeof text !== 'string') {
      throw new BadRequestException('Texto do aviso deve ser um texto');
    }
    const overlay = parseOverlayText(text);
    if (overlay === null) throw new BadRequestException('Texto do aviso deve ter no máximo 60 caracteres');
    return overlay;
  }

  private async freezeScreen(
    user: AuthUser,
    screen: ScreenRow,
    overlayText: string,
    gameCode?: string,
    categoryIds?: number[],
  ): Promise<ScreenView> {
    const codes = await effectiveCodesForOwner(
      this.prisma,
      screen.ownerId,
      screen.games.map((g) => g.gameCode),
    );

    // 1. Congelamento seletivo por categoria
    if (categoryIds && categoryIds.length > 0) {
      const targetGames = gameCode && codes.includes(gameCode) ? [gameCode] : codes;
      const existingMap = {
        ...parseScreenEnvelope(screen.frozenBoards).frozenCategories,
        ...this.notifier.getCategoryFreezes(screen.id),
      };
      const nowIso = new Date().toISOString();

      for (const code of targetGames) {
        const board = await this.boards.loadBoard(code);
        for (const catId of categoryIds) {
          const cat = board.categories.find((c) => c.id === catId);
          if (cat) {
            existingMap[`${code}:${cat.id}`] = {
              gameCode: code,
              categoryId: cat.id,
              categoryName: cat.name,
              overlayText,
              frozenAt: nowIso,
              snapshot: cat,
            };
          }
        }
      }

      this.notifier.setCategoryFreezes(screen.id, existingMap);
      await this.prisma.screen.update({
        where: { id: screen.id },
        data: {
          frozen: false,
          frozenAt: null,
          overlayText: null,
          frozenBoards: {
            __meta: true,
            frozenCategories: existingMap,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      const updated = await this.mustFind(screen.id);
      await this.log(updated, 'freeze', user);
      this.notifier.changed(screen.id);
      return this.toView(updated);
    }

    // 2. Congelamento total do telão (todas as categorias) — mantém formato { [gameCode]: Board }
    const frozenBoards: Record<string, Board> = {};
    for (const code of codes) frozenBoards[code] = await this.boards.loadBoard(code);

    this.notifier.setCategoryFreezes(screen.id, null);
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

  private async unfreezeScreen(
    user: AuthUser,
    screen: ScreenRow,
    gameCode?: string,
    categoryIds?: number[],
  ): Promise<ScreenView> {
    if (categoryIds && categoryIds.length > 0) {
      const existingMap = {
        ...parseScreenEnvelope(screen.frozenBoards).frozenCategories,
        ...this.notifier.getCategoryFreezes(screen.id),
      };

      // Se o telão inteiro estava congelado e o usuário pediu para liberar apenas 1 categoria,
      // converte as demais categorias dos boards congelados em categorias congeladas individuais.
      if (screen.frozen) {
        const env = parseScreenEnvelope(screen.frozenBoards);
        const nowIso = (screen.frozenAt ?? new Date()).toISOString();
        const ov = screen.overlayText ?? 'LEADERBOARD CONGELADO';
        for (const [gCode, b] of Object.entries(env.boards ?? {})) {
          for (const cat of b.categories ?? []) {
            existingMap[`${gCode}:${cat.id}`] = {
              gameCode: gCode,
              categoryId: cat.id,
              categoryName: cat.name,
              overlayText: ov,
              frozenAt: nowIso,
              snapshot: cat,
            };
          }
        }
      }

      for (const key of Object.keys(existingMap)) {
        const item = existingMap[key];
        const matchGame = !gameCode || item.gameCode === gameCode;
        if (matchGame && categoryIds.includes(item.categoryId)) {
          delete existingMap[key];
        }
      }

      const remaining = Object.keys(existingMap).length;
      this.notifier.setCategoryFreezes(screen.id, remaining > 0 ? existingMap : null);

      await this.prisma.screen.update({
        where: { id: screen.id },
        data: {
          frozen: false,
          frozenAt: null,
          overlayText: null,
          frozenBoards:
            remaining > 0
              ? ({ __meta: true, frozenCategories: existingMap } as unknown as Prisma.InputJsonValue)
              : Prisma.DbNull,
        },
      });
      const updated = await this.mustFind(screen.id);
      await this.log(updated, 'unfreeze', user);
      this.notifier.changed(screen.id);
      return this.toView(updated);
    }

    this.notifier.setCategoryFreezes(screen.id, null);
    await this.prisma.screen.update({
      where: { id: screen.id },
      data: { frozen: false, frozenAt: null, overlayText: null, frozenBoards: Prisma.DbNull },
    });
    const updated = await this.mustFind(screen.id);
    await this.log(updated, 'unfreeze', user);
    this.notifier.changed(screen.id);
    return this.toView(updated);
  }

  private async buildSpotlight(dto: ScreenSpotlightDto): Promise<ScreenSpotlight> {
    const board = await this.boards.loadBoard(dto.gameCode);
    const cat =
      (dto.categoryId ? board.categories.find((c) => c.id === dto.categoryId) : undefined) ??
      board.categories[0];
    if (!cat) {
      throw new BadRequestException('Nenhuma categoria disponível neste campeonato.');
    }

    if (dto.kind === 'podium') {
      const podium: PodiumSpotlight = {
        kind: 'podium',
        gameCode: board.game.code,
        gameName: board.game.name,
        categoryId: cat.id,
        categoryName: cat.name,
        revealStep: Math.min(3, Math.max(1, dto.revealStep ?? 3)),
        autoAdvance: Boolean(dto.autoAdvance),
        triggeredAt: new Date().toISOString(),
      };
      return podium;
    }

    // kind === 'heat_call'
    const gameRow = await this.prisma.game.findUnique({
      where: { code: dto.gameCode },
      select: { lanesCount: true },
    });
    const lanesPerHeat = Math.max(2, gameRow?.lanesCount ?? 4);

    const workouts = await this.prisma.workout.findMany({
      where: { game: dto.gameCode, category: cat.id },
      orderBy: { code: 'asc' },
    });
    const pickedWorkout =
      (dto.workoutCode ? workouts.find((w) => w.code === dto.workoutCode) : undefined) ?? workouts[0];
    const workoutTitle = pickedWorkout?.title ?? cat.wodTitles[0] ?? 'WOD 1';

    let lanes: HeatCallLane[] = Array.isArray(dto.lanes) && dto.lanes.length > 0 ? dto.lanes : [];
    let heatNumber = dto.heatNumber && dto.heatNumber > 0 ? dto.heatNumber : 1;
    let totalHeats = 1;
    let startTime = '09:00';

    if (lanes.length === 0) {
      const dbHeats = pickedWorkout
        ? await this.prisma.heat.findMany({
            where: { gameCode: dto.gameCode, categoryId: cat.id, workoutCode: pickedWorkout.code },
            include: {
              slots: {
                include: {
                  registration: {
                    include: { athletes: { select: { name: true }, orderBy: { code: 'asc' } } },
                  },
                },
                orderBy: { laneNumber: 'asc' },
              },
            },
            orderBy: { heatNumber: 'asc' },
          })
        : [];

      const rowByTeamCode = new Map(cat.rows.map((r) => [r.teamCode, r]));

      if (dbHeats.length > 0) {
        totalHeats = dbHeats.length;
        const targetHeat = dbHeats.find((h) => h.heatNumber === heatNumber) ?? dbHeats[0];
        heatNumber = targetHeat.heatNumber;
        startTime = targetHeat.startTime || '09:00';
        lanes = targetHeat.slots.map((slot) => {
          const scoreRow = rowByTeamCode.get(slot.teamCode);
          return {
            laneNumber: slot.laneNumber,
            teamCode: slot.teamCode,
            teamName: slot.registration?.team ?? scoreRow?.team ?? `Equipe #${slot.teamCode}`,
            number: slot.registration?.number ?? scoreRow?.number ?? `#${slot.teamCode}`,
            athletes:
              slot.registration?.athletes?.map((a) => a.name) ?? scoreRow?.athletes ?? [],
            rank: scoreRow?.rank,
            totalDisplay: scoreRow ? `${scoreRow.totalDisplay} ${board.game.totalUnit}` : undefined,
          };
        });
      } else {
        // Fallback inteligente: agrupa as equipes ativas da categoria em baterias de lanesPerHeat raias
        const activeRows = cat.rows.filter((r) => r.status !== 'cancelled');
        totalHeats = Math.max(1, Math.ceil(activeRows.length / lanesPerHeat));
        heatNumber = Math.min(totalHeats, Math.max(1, heatNumber));
        const slice = activeRows.slice((heatNumber - 1) * lanesPerHeat, heatNumber * lanesPerHeat);
        const totalMinutes = 8 * 60 + (heatNumber - 1) * 15;
        startTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
        lanes = slice.map((r, idx) => ({
          laneNumber: idx + 1,
          teamCode: r.teamCode,
          teamName: r.team,
          number: r.number,
          athletes: r.athletes,
          rank: r.rank,
          totalDisplay: `${r.totalDisplay} ${board.game.totalUnit}`,
        }));
      }
    }

    const heatCall: HeatCallSpotlight = {
      kind: 'heat_call',
      gameCode: board.game.code,
      gameName: board.game.name,
      categoryId: cat.id,
      categoryName: cat.name,
      workoutCode: pickedWorkout?.code,
      workoutTitle,
      heatNumber,
      totalHeats,
      startTime,
      message: dto.message?.trim() || 'DIRIJAM-SE ÀS RAIAS DE LARGADA',
      lanes,
      triggeredAt: new Date().toISOString(),
    };
    return heatCall;
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

  private async getControlled(user: AuthUser, id: string): Promise<ScreenRow> {
    const screen = await this.prisma.screen.findUnique({ where: { id }, include: { games: true } });
    if (!screen || !screen.claimedAt || !canControlScreen(user, screen)) {
      throw new NotFoundException('Telão não encontrado');
    }
    return screen;
  }

  private controlledScreens(user: AuthUser): Promise<ScreenRow[]> {
    return this.prisma.screen.findMany({
      where: { claimedAt: { not: null }, ...(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.JUDGE ? {} : { ownerId: user.id }) },
      include: { games: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // freeze-all/unfreeze-all: só os telões de que o usuário é DONO (super admin congela os de outros um a um).
  private ownScreens(user: AuthUser): Promise<ScreenRow[]> {
    return this.prisma.screen.findMany({
      where: { claimedAt: { not: null }, ownerId: user.id },
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
    const env = parseScreenEnvelope(s.frozenBoards);
    const mergedMap: Record<string, FrozenCategoryMeta> = {
      ...(env.frozenCategories ?? {}),
      ...this.notifier.getCategoryFreezes(s.id),
    };
    const frozenCategories = summarizeFrozenCategories(mergedMap);
    const spotlight = this.notifier.getSpotlight(s.id) ?? env.spotlight ?? null;

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
      ...(frozenCategories.length > 0 ? { frozenCategories } : {}),
      ...(spotlight ? { spotlight } : {}),
    };
  }
}
