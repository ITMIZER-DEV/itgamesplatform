export type ScoringMode = 'points_table' | 'rank_sum' | 'total_time';
export type Tiebreak = 'last_workout' | 'most_wins' | 'best_ranks' | `split:${string}`;

export interface ScoringRule {
  mode: ScoringMode;
  pointsTable: number[];
  tiebreak: Tiebreak;
}

/** Tabela de pontos padrão (100, 95, 90, 85, decrescendo 5 em 5). */
export const DEFAULT_POINTS_TABLE: number[] = [
  100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5,
];

/** Tabela oficial CrossFit Games (100, 94, 88, 84, 80, 76, 72, 68, 64, 60, decrescendo 2 em 2 até 1). */
export const GAMES_POINTS_TABLE: number[] = [
  100, 94, 88, 84, 80, 76, 72, 68, 64, 60, 58, 56, 54, 52, 50, 48, 46, 44, 42, 40,
  38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 1,
];

const MODES: ScoringMode[] = ['points_table', 'rank_sum', 'total_time'];

/** Valida a tabela: 1 a 200 números finitos >= 0. */
export function parsePointsTable(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 200) return null;
  for (const v of input) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  }
  return [...(input as number[])];
}

/** Valida o critério de desempate. */
export function parseTiebreak(input: unknown): Tiebreak | null {
  if (typeof input !== 'string') return null;
  if (input === 'last_workout' || input === 'most_wins' || input === 'best_ranks') return input;
  if (input.startsWith('split:') && input.slice('split:'.length).trim().length > 0) {
    return input as Tiebreak;
  }
  return null;
}

export function resolveRule(game: {
  eventType?: string | null;
  scoringMode?: string | null;
  tiebreak?: string | null;
  pointsTable?: unknown;
  isLowestPointsBetter?: boolean | null;
}): ScoringRule {
  let mode: ScoringMode;
  if (game.scoringMode && (MODES as string[]).includes(game.scoringMode)) {
    mode = game.scoringMode as ScoringMode;
  } else if (game.eventType === 'hyrox') {
    mode = 'total_time';
  } else if (game.isLowestPointsBetter === true) {
    mode = 'rank_sum';
  } else {
    mode = 'points_table';
  }
  return {
    mode,
    pointsTable: parsePointsTable(game.pointsTable) ?? [...DEFAULT_POINTS_TABLE],
    tiebreak: parseTiebreak(game.tiebreak) ?? 'last_workout',
  };
}

/** Pontos por posição (1-based): <= 0 vale 0; além do fim da tabela vale 1. */
export function pointsForPosition(table: number[], position: number): number {
  if (position <= 0) return 0;
  return position <= table.length ? table[position - 1] : 1;
}
