import { Injectable, NotFoundException } from '@nestjs/common';
import { GameAccessService } from '../../common/access/game-access.service';
import { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { computeBoard } from './engine';
import { Board, EngineInput } from './types';

// Status de súmula que ficam fora do placar: rascunho não é súmula enviada.
// Os demais (inclusive provisórios) entram, e 'voided' entra marcado como anulado.
const STATUS_FORA = new Set(['draft']);

export interface BoardRows {
  game: {
    code: string;
    name: string;
    location?: string | null;
    eventType?: string | null;
    scoringMode?: string | null;
    tiebreak?: string | null;
    pointsTable?: unknown;
    isLowestPointsBetter?: boolean | null;
  };
  categories: { code: number; name: string }[];
  workouts: { code: number; category: number; title?: string | null; type?: string | null; timeCap?: string | null }[];
  registrations: {
    code: number;
    categoryId: number;
    team: string;
    number?: string | null;
    status?: string | null;
    athletes: { name: string }[];
  }[];
  scores: {
    idEvent: number;
    category: number;
    codeTeam: number;
    time?: string | null;
    weight?: string | null;
    reps?: string | null;
    penaltySeconds?: number | null;
    tieBreakTime?: string | null;
    isWO?: boolean | null;
    scoreStatus?: string | null;
    splits?: unknown;
  }[];
}

function parseSplits(raw: unknown): { name: string; seconds: number }[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .filter((s) => s && typeof s.name === 'string' && typeof s.seconds === 'number')
    .map((s) => ({ name: s.name as string, seconds: s.seconds as number }));
  return out.length ? out : null;
}

// Converte o que veio do banco na entrada do motor (puro, sem acesso a dados).
export function toEngineInput(rows: BoardRows): EngineInput {
  return {
    game: {
      code: rows.game.code,
      name: rows.game.name,
      location: rows.game.location,
      eventType: rows.game.eventType,
      scoringMode: rows.game.scoringMode,
      tiebreak: rows.game.tiebreak,
      pointsTable: rows.game.pointsTable,
      isLowestPointsBetter: rows.game.isLowestPointsBetter,
    },
    categories: rows.categories.map((c) => ({ code: c.code, name: c.name })),
    workouts: rows.workouts.map((w) => ({
      code: w.code,
      category: w.category,
      title: w.title,
      type: w.type,
      timeCap: w.timeCap,
    })),
    teams: rows.registrations.map((r) => ({
      code: r.code,
      categoryId: r.categoryId,
      team: r.team,
      number: r.number,
      athletes: r.athletes.map((a) => a.name),
      status: r.status === 'cancelled' ? ('cancelled' as const) : ('active' as const),
    })),
    scores: rows.scores
      .filter((s) => !STATUS_FORA.has(s.scoreStatus ?? ''))
      .map((s) => ({
        workoutCode: s.idEvent,
        category: s.category,
        teamCode: s.codeTeam,
        time: s.time,
        weight: s.weight,
        reps: s.reps,
        penaltySeconds: s.penaltySeconds,
        tieBreakTime: s.tieBreakTime,
        isWO: s.isWO,
        voided: s.scoreStatus === 'voided',
        splits: parseSplits(s.splits),
      })),
  };
}

@Injectable()
export class BoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GameAccessService,
  ) {}

  // Placar calculado pelo motor; mesma regra de visibilidade do leaderboard público.
  // Só dados públicos: atletas apenas por nome, sem e-mail/CPF/telefone.
  async getBoard(code: string, user?: AuthUser): Promise<Board> {
    await this.access.assertCanView(user, code);
    return this.loadBoard(code);
  }

  // Calcula o placar sem checar visibilidade: quem chama já autorizou (ex.: telões).
  async loadBoard(code: string): Promise<Board> {
    const game = await this.prisma.game.findUnique({
      where: { code },
      select: {
        code: true,
        name: true,
        eventType: true,
        isLowestPointsBetter: true,
        location: true,
        scoringMode: true,
        tiebreak: true,
        pointsTable: true,
      },
    });
    if (!game) throw new NotFoundException('Campeonato não encontrado');

    const [categories, workouts, registrations, scores] = await Promise.all([
      this.prisma.category.findMany({
        where: { gamesId: code },
        select: { code: true, name: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.workout.findMany({
        where: { game: code },
        select: { code: true, category: true, title: true, type: true, timeCap: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.registration.findMany({
        where: { gameCode: code },
        select: {
          code: true,
          categoryId: true,
          team: true,
          number: true,
          status: true,
          athletes: { select: { name: true }, orderBy: { code: 'asc' } },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.score.findMany({
        where: { game: code },
        select: {
          idEvent: true,
          category: true,
          codeTeam: true,
          time: true,
          weight: true,
          reps: true,
          penaltySeconds: true,
          tieBreakTime: true,
          isWO: true,
          scoreStatus: true,
          splits: true,
        },
        orderBy: { code: 'asc' },
      }),
    ]);

    return computeBoard(toEngineInput({ game, categories, workouts, registrations, scores }));
  }
}
