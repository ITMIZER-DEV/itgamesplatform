// Regras puras do cálculo oficial (sem acesso a banco).

export interface HeatLite {
  heatNumber: number;
  status: string;
}

export interface Readiness {
  canConfirm: boolean;
  blockers: string[];
  warnings: string[];
  heats: { total: number; completed: number; pending: number[] };
}

export type OfficialState = 'confirmed' | 'ready' | 'blocked';

/** Chave de unicidade do resultado ativo: campeonato:categoria:WOD. */
export function officialKey(game: string, category: number, event: number): string {
  return `${game}:${category}:${event}`;
}

/** Avalia se a categoria pode ter o WOD confirmado. */
export function evaluateReadiness(i: {
  hasWorkoutLink: boolean;
  heats: HeatLite[];
  scoreStatuses: (string | null)[];
  validResults: number;
}): Readiness {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const pending = i.heats
    .filter((h) => h.status !== 'completed')
    .map((h) => h.heatNumber)
    .sort((a, b) => a - b);
  const heats = {
    total: i.heats.length,
    completed: i.heats.length - pending.length,
    pending,
  };

  if (!i.hasWorkoutLink || i.heats.length === 0) {
    warnings.push('WOD sem baterias cadastradas: não há como conferir o encerramento.');
  } else if (pending.length > 0) {
    blockers.push(`Baterias não encerradas: ${pending.join(', ')}.`);
  }

  const contested = i.scoreStatuses.filter((s) => s === 'contested').length;
  if (contested > 0) {
    blockers.push(`Há ${contested} súmula(s) contestada(s) aguardando decisão.`);
  }

  if (i.validResults <= 0) {
    blockers.push('Nenhuma súmula válida neste WOD.');
  }

  const drafts = i.scoreStatuses.filter((s) => s === 'draft').length;
  if (drafts > 0) {
    warnings.push(`Há ${drafts} súmula(s) em rascunho; elas não contam no cálculo.`);
  }

  return { canConfirm: blockers.length === 0, blockers, warnings, heats };
}

export function officialState(r: Readiness, confirmed: boolean): OfficialState {
  if (confirmed) return 'confirmed';
  return r.blockers.length === 0 ? 'ready' : 'blocked';
}

/** Motivo da reversão: texto aparado de 5 a 300 caracteres, senão null. */
export function parseRevertReason(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const t = input.trim();
  return t.length >= 5 && t.length <= 300 ? t : null;
}
