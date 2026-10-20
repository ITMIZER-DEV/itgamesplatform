// Montagem pura das linhas do cálculo oficial (sem acesso a banco).
import { EngineInput, WodEntry, WodStatus } from '../scoring/types';

export interface PreviewRow {
  rank: number;
  teamCode: number;
  team: string;
  number: string;
  display: string;
  points: number;
  status: WodStatus;
}

export interface SnapshotRow {
  teamCode: number;
  rank: number;
  points: number;
  display: string;
  status: WodStatus;
  seconds: number | null;
  splits: { name: string; seconds: number }[] | null;
}

const statusOrder: Record<WodStatus, number> = { scored: 0, wo: 1, none: 2, cancelled: 3 };

/** Linhas da prévia: todas as equipes da categoria, em ordem de colocação (canceladas por último). */
export function buildPreviewRows(
  input: EngineInput,
  categoryCode: number,
  entries: ReadonlyMap<number, WodEntry> | null,
): PreviewRow[] {
  const teams = input.teams.filter((t) => t.categoryId === categoryCode);
  const rows = teams.map<PreviewRow>((t) => {
    const e = entries?.get(t.code);
    const status: WodStatus = e?.status ?? (t.status === 'cancelled' ? 'cancelled' : 'none');
    return {
      rank: e?.rank ?? 0,
      teamCode: t.code,
      team: t.team,
      number: t.number ?? '',
      display: e?.display ?? '',
      points: e?.points ?? 0,
      status,
    };
  });
  return rows.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] || a.rank - b.rank || a.teamCode - b.teamCode,
  );
}

/** Linhas do instantâneo gravado na confirmação: todas as equipes da categoria, inclusive W.O. e canceladas. */
export function toSnapshotRows(
  input: EngineInput,
  categoryCode: number,
  entries: ReadonlyMap<number, WodEntry>,
): SnapshotRow[] {
  return input.teams
    .filter((t) => t.categoryId === categoryCode)
    .sort((a, b) => a.code - b.code)
    .map((t) => {
      const e = entries.get(t.code);
      return {
        teamCode: t.code,
        rank: e?.rank ?? 0,
        points: e?.points ?? 0,
        display: e?.display ?? '',
        status: e?.status ?? (t.status === 'cancelled' ? 'cancelled' : 'none'),
        seconds: e?.seconds ?? null,
        splits: e?.splits && e.splits.length ? e.splits : null,
      };
    });
}
