// Board oficial: monta o placar só a partir dos instantâneos confirmados (puro, sem acesso a dados).
import { BoardRows, toEngineInput } from './board.service';
import { buildBoard } from './engine';
import { Board, WodEntry, WodStatus } from './types';
import { markOfficial } from './visibility';

export interface ConfirmedResult {
  categoryId: number;
  eventId: number;
  rows: {
    teamCode: number;
    rank: number;
    points: number;
    display: string;
    status: WodStatus;
    seconds?: number | null;
    splits?: { name: string; seconds: number }[] | null;
  }[];
}

/**
 * Placar oficial: pontos e totais vêm dos instantâneos, mesmo que as súmulas tenham mudado depois.
 * Categorias sem WOD confirmado ficam de fora; linhas de equipes que não existem mais são ignoradas
 * (o motor itera as equipes atuais) e equipes novas aparecem como 'none' no WOD confirmado.
 */
export function buildOfficialBoard(rows: BoardRows, confirmed: ConfirmedResult[], now: Date = new Date()): Board {
  const input = toEngineInput(rows);
  const byPair = new Map<string, ConfirmedResult>();
  for (const c of confirmed) byPair.set(`${c.categoryId}:${c.eventId}`, c);

  const board = buildBoard(
    input,
    (categoryCode, workoutCode) => {
      const result = byPair.get(`${categoryCode}:${workoutCode}`);
      if (!result) return null;
      const workout = input.workouts.find((w) => w.code === workoutCode && w.category === categoryCode);
      const title = workout?.title || `WOD ${workoutCode}`;
      const map = new Map<number, WodEntry>();
      for (const r of result.rows) {
        const entry: WodEntry = { title, display: r.display, rank: r.rank, points: r.points, status: r.status };
        if (r.seconds !== null && r.seconds !== undefined) entry.seconds = r.seconds;
        if (r.splits && r.splits.length) entry.splits = r.splits;
        map.set(r.teamCode, entry);
      }
      return map;
    },
    now,
  );

  const withConfirmed = new Set(confirmed.map((c) => c.categoryId));
  return markOfficial({ ...board, categories: board.categories.filter((c) => withConfirmed.has(c.id)) });
}
