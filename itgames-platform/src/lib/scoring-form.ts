// Auxiliares do formulário de regra de pontuação do campeonato.

export type ScoringMode = 'points_table' | 'rank_sum' | 'total_time';
export type TiebreakKind = 'last_workout' | 'most_wins' | 'split';

// Espelha DEFAULT_POINTS_TABLE da API (itgames-api/src/modules/scoring/rules.ts)
export const DEFAULT_POINTS_TABLE: number[] = [
  100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 47, 44, 41, 38, 35, 32, 29, 26, 23, 20, 18, 16, 14,
  12, 10, 8, 6, 4, 2, 1,
];

export const MAX_POINTS_TABLE_ITEMS = 200;

// Lista de inteiros >= 0 separados por vírgula, ponto e vírgula, espaço ou quebra de linha.
// null se vazia, com valor não inteiro (90.5, 1e3), negativo ou longa demais.
export function parsePointsInput(text: string): number[] | null {
  const parts = text.split(/[\s,;]+/).filter((p) => p !== '');
  if (parts.length === 0 || parts.length > MAX_POINTS_TABLE_ITEMS) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isSafeInteger(n)) return null;
    out.push(n);
  }
  return out;
}

export function formatPointsInput(table: number[]): string {
  return table.join(', ');
}

// Valor de desempate da API ('last_workout' | 'most_wins' | 'split:<nome>') -> estado do formulário
export function tiebreakToForm(tiebreak?: string | null): { kind: TiebreakKind; split: string } {
  if (tiebreak === 'most_wins') return { kind: 'most_wins', split: '' };
  if (typeof tiebreak === 'string' && tiebreak.startsWith('split:')) {
    return { kind: 'split', split: tiebreak.slice('split:'.length) };
  }
  return { kind: 'last_workout', split: '' };
}

// Estado do formulário -> valor da API; null se o nome do parcial estiver vazio
export function formToTiebreak(kind: TiebreakKind, split: string): string | null {
  if (kind !== 'split') return kind;
  const name = split.trim();
  return name ? `split:${name}` : null;
}

// Regra padrão do formulário conforme o tipo do evento (HYROX é por tempo total)
export function scoringDefaultsForEventType(eventType: string): {
  mode: ScoringMode;
  tiebreakKind: TiebreakKind;
  tiebreakSplit: string;
} {
  if (eventType === 'hyrox') return { mode: 'total_time', tiebreakKind: 'split', tiebreakSplit: 'Wall Balls' };
  return { mode: 'points_table', tiebreakKind: 'last_workout', tiebreakSplit: '' };
}
