import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GameAccessService } from '../../common/access/game-access.service';
import { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaderboardNotifier } from '../leaderboard/leaderboard-notifier.service';
import { BoardService, toEngineInput } from '../scoring/board.service';
import { computeWorkoutEntries } from '../scoring/engine';
import {
  OfficialState,
  Readiness,
  evaluateReadiness,
  officialKey,
  officialState,
  parseRevertReason,
} from './official-logic';
import { OfficialLockService } from './official-lock.service';
import { PreviewRow, blockedMessage, buildPreviewRows, countScored, toSnapshotRows } from './official-rows';

type Db = PrismaService | Prisma.TransactionClient;

export interface OfficialEventStatus {
  eventId: number;
  title: string;
  state: OfficialState;
  heats: Readiness['heats'];
  contested: number;
  draft: number;
  confirmedAt: string | null;
  confirmedByName: string | null;
}

export interface OfficialStatus {
  categories: { id: number; name: string; events: OfficialEventStatus[] }[];
}

export interface OfficialPreview {
  eventId: number;
  title: string;
  state: OfficialState;
  canConfirm: boolean;
  blockers: string[];
  warnings: string[];
  heats: Readiness['heats'];
  rows: PreviewRow[];
  woTeams: string[];
}

const ALREADY_MSG = 'Este WOD já foi calculado oficialmente nesta categoria.';
const REASON_MSG = 'Informe o motivo da reversão (5 a 300 caracteres)';
const NOT_ACTIVE_MSG = 'Este WOD não tem cálculo oficial ativo para reverter.';

@Injectable()
export class OfficialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GameAccessService,
    private readonly boards: BoardService,
    private readonly notifier: LeaderboardNotifier,
    private readonly lock: OfficialLockService,
  ) {}

  // ---------- consultas ----------

  async status(code: string, user: AuthUser): Promise<OfficialStatus> {
    await this.access.assertCanManage(user, code);
    const [rows, categories, events, heats, scores, actives] = await Promise.all([
      this.boards.loadRows(code),
      this.prisma.category.findMany({ where: { gamesId: code }, select: { code: true, name: true }, orderBy: { code: 'asc' } }),
      this.prisma.event.findMany({
        where: { game: code },
        select: { idEvent: true, workout: true, category: true, title: true },
        orderBy: { idEvent: 'asc' },
      }),
      this.prisma.heat.findMany({
        where: { gameCode: code },
        select: { categoryId: true, workoutCode: true, heatNumber: true, status: true },
      }),
      this.prisma.score.findMany({
        where: { game: code },
        select: { category: true, idEvent: true, codeTeam: true, scoreStatus: true },
      }),
      this.prisma.officialResult.findMany({
        where: { gameCode: code, activeKey: { not: null } },
        select: { categoryId: true, eventId: true, confirmedAt: true, confirmedByName: true },
      }),
    ]);

    const input = toEngineInput(rows);
    return {
      categories: categories.map((c) => ({
        id: c.code,
        name: c.name,
        events: events
          .filter((e) => e.category === c.code)
          .map((e) => {
            const st = scores.filter((s) => s.category === c.code && s.idEvent === e.idEvent);
            const r = this.readiness(
              e.workout,
              heats.filter((h) => h.categoryId === c.code),
              st.map((x) => x.scoreStatus),
              countScored(computeWorkoutEntries(input, c.code, e.idEvent)),
            );
            const done = actives.find((a) => a.categoryId === c.code && a.eventId === e.idEvent);
            return {
              eventId: e.idEvent,
              title: e.title,
              state: officialState(r, !!done),
              heats: r.heats,
              contested: st.filter((s) => s.scoreStatus === 'contested').length,
              draft: st.filter((s) => s.scoreStatus === 'draft').length,
              confirmedAt: done ? done.confirmedAt.toISOString() : null,
              confirmedByName: done ? done.confirmedByName : null,
            };
          }),
      })),
    };
  }

  async preview(code: string, categoryId: number, eventId: number, user: AuthUser): Promise<OfficialPreview> {
    await this.access.assertCanManage(user, code);
    const event = await this.findEvent(this.prisma, code, categoryId, eventId);
    const active = await this.prisma.officialResult.count({
      where: { activeKey: officialKey(code, categoryId, eventId) },
    });
    return (await this.compute(this.prisma, code, categoryId, event, active > 0)).preview;
  }

  async confirm(code: string, categoryId: number, eventId: number, user: AuthUser, _ip?: string) {
    await this.access.assertCanManage(user, code);
    const event = await this.findEvent(this.prisma, code, categoryId, eventId);
    const key = officialKey(code, categoryId, eventId);

    // Verificação rápida antes de abrir a transação (a unicidade de verdade é o activeKey).
    if ((await this.prisma.officialResult.count({ where: { activeKey: key } })) > 0) {
      throw new ConflictException(ALREADY_MSG);
    }
    const pre = await this.compute(this.prisma, code, categoryId, event, false);
    if (!pre.preview.canConfirm) this.throwBlocked(pre.preview.blockers);

    let confirmedAt: Date;
    try {
      confirmedAt = await this.prisma.$transaction(async (tx) => {
        // Serializa com quem grava súmula deste WOD (ver OfficialLockService).
        await this.lock.lockEventForUpdate(tx, code, eventId);
        // Cria o resultado primeiro: a trava da súmula existe o quanto antes.
        const result = await tx.officialResult.create({
          data: {
            gameCode: code,
            categoryId,
            eventId,
            activeKey: key,
            confirmedById: user.id,
            confirmedByName: user.name,
            teamCount: 0,
            woCount: 0,
          },
        });

        // Relê as súmulas já com o resultado criado e recalcula.
        const calc = await this.compute(tx, code, categoryId, event, false);
        if (!calc.preview.canConfirm || !calc.entries) this.throwBlocked(calc.preview.blockers);

        const snapshot = toSnapshotRows(calc.input, categoryId, calc.entries);
        const woCount = snapshot.filter((r) => r.status === 'wo').length;
        await tx.officialResultRow.createMany({
          data: snapshot.map((r) => ({
            resultId: result.id,
            teamCode: r.teamCode,
            rank: r.rank,
            points: r.points,
            display: r.display,
            status: r.status,
            seconds: r.seconds,
            splits: r.splits ?? Prisma.DbNull,
          })),
        });
        await tx.officialResult.update({
          where: { id: result.id },
          data: { teamCount: snapshot.length, woCount },
        });
        await tx.officialLog.create({
          data: {
            gameCode: code,
            categoryId,
            eventId,
            resultId: result.id,
            action: 'confirm',
            userId: user.id,
            userName: user.name,
            teamCount: snapshot.length,
            woCount,
          },
        });
        return result.confirmedAt;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(ALREADY_MSG);
      }
      throw e;
    }

    this.notifier.changed(code);
    const done = await this.compute(this.prisma, code, categoryId, event, true);
    return { ...done.preview, confirmedAt: confirmedAt.toISOString() };
  }

  async revert(code: string, categoryId: number, eventId: number, reasonInput: unknown, user: AuthUser) {
    await this.access.assertCanManage(user, code);
    const reason = parseRevertReason(reasonInput);
    if (!reason) throw new BadRequestException(REASON_MSG);
    await this.findEvent(this.prisma, code, categoryId, eventId);
    const key = officialKey(code, categoryId, eventId);

    await this.prisma.$transaction(async (tx) => {
      await this.lock.lockEventForUpdate(tx, code, eventId);
      const active = await tx.officialResult.findUnique({ where: { activeKey: key } });
      if (!active) throw new ConflictException(NOT_ACTIVE_MSG);
      // Condiciona ao activeKey para que reversões simultâneas não passem as duas.
      const upd = await tx.officialResult.updateMany({
        where: { id: active.id, activeKey: key },
        data: { revertedAt: new Date(), revertedByName: user.name, revertReason: reason, activeKey: null },
      });
      if (upd.count !== 1) throw new ConflictException(NOT_ACTIVE_MSG);
      await tx.officialLog.create({
        data: {
          gameCode: code,
          categoryId,
          eventId,
          resultId: active.id,
          action: 'revert',
          userId: user.id,
          userName: user.name,
          reason,
          teamCount: active.teamCount,
          woCount: active.woCount,
        },
      });
    });

    this.notifier.changed(code);
    return { ok: true };
  }

  async history(code: string, user: AuthUser) {
    await this.access.assertCanManage(user, code);
    return this.prisma.officialLog.findMany({
      where: { gameCode: code },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
  }

  // ---------- internos ----------

  private throwBlocked(blockers: string[]): never {
    throw new ConflictException(blockedMessage(blockers));
  }

  private async findEvent(db: Db, code: string, categoryId: number, eventId: number) {
    const event = await db.event.findFirst({
      where: { game: code, idEvent: eventId, category: categoryId },
      select: { idEvent: true, workout: true, category: true, title: true },
    });
    if (!event) throw new NotFoundException('WOD não encontrado nesta categoria');
    return event;
  }

  private readiness(
    workout: number | null,
    categoryHeats: { workoutCode: number; heatNumber: number; status: string }[],
    scoreStatuses: (string | null)[],
    validResults: number,
  ): Readiness {
    const hasWorkoutLink = workout != null;
    const heats = hasWorkoutLink
      ? categoryHeats.filter((h) => h.workoutCode === workout).map((h) => ({ heatNumber: h.heatNumber, status: h.status }))
      : [];
    // validResults vem do motor: só equipes com resultado 'scored' (W.O./canceladas não contam).
    return evaluateReadiness({ hasWorkoutLink, heats, scoreStatuses, validResults });
  }

  // Lê o necessário e calcula prontidão + prévia completa (com pontos) do WOD na categoria.
  private async compute(
    db: Db,
    code: string,
    categoryId: number,
    event: { idEvent: number; workout: number | null; title: string },
    confirmed: boolean,
  ) {
    const [rows, heats, scores] = await Promise.all([
      this.boards.loadRows(code, db),
      db.heat.findMany({
        where: { gameCode: code, categoryId },
        select: { workoutCode: true, heatNumber: true, status: true },
      }),
      db.score.findMany({
        where: { game: code, category: categoryId, idEvent: event.idEvent },
        select: { codeTeam: true, scoreStatus: true },
      }),
    ]);
    const input = toEngineInput(rows);
    const entries = computeWorkoutEntries(input, categoryId, event.idEvent);
    const r = this.readiness(
      event.workout,
      heats,
      scores.map((x) => x.scoreStatus),
      countScored(entries),
    );
    const warnings = confirmed ? [...r.warnings, 'Este WOD já foi calculado oficialmente.'] : r.warnings;
    const previewRows = buildPreviewRows(input, categoryId, entries);
    const preview: OfficialPreview = {
      eventId: event.idEvent,
      title: event.title,
      state: officialState(r, confirmed),
      canConfirm: r.canConfirm && !confirmed,
      blockers: r.blockers,
      warnings,
      heats: r.heats,
      rows: previewRows,
      woTeams: previewRows.filter((p) => p.status === 'wo').map((p) => p.team),
    };
    return { preview, entries, input };
  }
}
