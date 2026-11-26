// Regulamento Summer Games: ordem dentro de cada tipo de WOD e os formatos que a arena realmente grava
// (App do Juiz, Mesa do Head Judge e lançamentos antigos). Cada prova A/B pontua separada.
import { computeBoard } from '../../src/modules/scoring/engine';
import { EngineInput, EngineScore } from '../../src/modules/scoring/types';

const NOW = new Date('2026-11-28T12:00:00.000Z');

function input(
  workout: Omit<EngineInput['workouts'][number], 'category'>,
  scores: Omit<EngineScore, 'workoutCode' | 'category'>[],
): EngineInput {
  const teams = scores.map((s) => ({
    code: s.teamCode,
    categoryId: 1,
    team: `Dupla ${s.teamCode}`,
    number: `${s.teamCode}`,
    athletes: [],
    status: 'active' as const,
  }));
  return {
    game: { code: 'SG', name: 'Summer', eventType: 'crossfit', scoringMode: 'points_table', tiebreak: 'best_ranks' },
    categories: [{ code: 1, name: 'Cat' }],
    workouts: [{ ...workout, category: 1 }],
    teams,
    scores: scores.map((s) => ({ ...s, workoutCode: workout.code, category: 1 })),
  };
}

/** Códigos das equipes na ordem do WOD, com a posição: "código@posição". */
function order(i: EngineInput): string[] {
  const rows = computeBoard(i, NOW).categories[0].rows;
  return rows
    .map((r) => ({ code: r.teamCode, rank: r.wods[0].rank }))
    .sort((a, b) => a.rank - b.rank || a.code - b.code)
    .map((x) => `${x.code}@${x.rank}`);
}

describe('WOD 1-A (Row, for_time, cap 05:00)', () => {
  const wod = { code: 101, title: 'WOD 1-A — 800m ROW', type: 'for_time', timeCap: '05:00' };

  it('quem terminou vem antes; CAP ordena por menos metros faltando (formato "05:00" + metros)', () => {
    const i = input(wod, [
      { teamCode: 1, time: '05:00', reps: '95' },
      { teamCode: 2, time: '04:58' },
      { teamCode: 3, time: '05:00', reps: '50' },
      { teamCode: 4, time: '04:15' },
    ]);
    expect(order(i)).toEqual(['4@1', '2@2', '3@3', '1@4']);
  });

  it('aceita o formato do App do Juiz "CAP +50m"', () => {
    const i = input(wod, [
      { teamCode: 1, time: 'CAP +95m', reps: '95' },
      { teamCode: 2, time: 'CAP +50m', reps: '50' },
      { teamCode: 3, time: '04:59.5' },
    ]);
    expect(order(i)).toEqual(['3@1', '2@2', '1@3']);
  });
});

describe('WOD 1-B (Death By, amrap): rounds → reps → menor soma dos tempos', () => {
  const wod = { code: 102, title: 'WOD 1-B — DEATH BY', type: 'amrap', timeCap: '15:00' };

  it('5 rounds completos desempatam pela soma dos tempos gravada no texto (Mesa: "5R (13:31 | ...)")', () => {
    const i = input(wod, [
      { teamCode: 1, time: '5R (13:40 | R1 02:40, R2 02:40)', reps: '0' },
      { teamCode: 2, time: '5R (13:31 | R1 02:40, R2 02:40)', reps: '0' },
      { teamCode: 3, time: '4R + 1 reps (08:19 | R1 02:40)', reps: '1' },
    ]);
    expect(order(i)).toEqual(['2@1', '1@2', '3@3']);
  });

  it('campo de desempate explícito tem prioridade sobre o texto', () => {
    const i = input(wod, [
      { teamCode: 1, time: '5R (13:40)', tieBreakTime: '12:00' },
      { teamCode: 2, time: '5R (13:31)' },
    ]);
    expect(order(i)).toEqual(['1@1', '2@2']);
  });

  it('entende o formato do App do Juiz ("5 Rounds (12:30)" e "3 Rds + 12 reps")', () => {
    const i = input(wod, [
      { teamCode: 1, time: '3 Rds + 12 reps', reps: '12' },
      { teamCode: 2, time: '5 Rounds (12:30)', tieBreakTime: '12:30' },
      { teamCode: 3, time: '3 Rds + 20 reps', reps: '20' },
      { teamCode: 4, time: '5 Rounds (11:58)', tieBreakTime: '11:58' },
    ]);
    expect(order(i)).toEqual(['4@1', '2@2', '3@3', '1@4']);
  });

  it('rounds valem mais que reps (4R + 1 rep à frente de 3R + 15 reps)', () => {
    const i = input(wod, [
      { teamCode: 1, time: '3R + 15 reps (07:30)', reps: '15' },
      { teamCode: 2, time: '4R + 1 reps (08:19)', reps: '1' },
    ]);
    expect(order(i)).toEqual(['2@1', '1@2']);
  });
});

describe('WOD 2 (Sync & Burn, for_time, cap 10:00)', () => {
  const wod = { code: 103, title: 'WOD 2 — SYNC & BURN', type: 'for_time', timeCap: '10:00' };

  it('menor tempo vence; CAP ordena por menos reps faltando', () => {
    const i = input(wod, [
      { teamCode: 1, time: 'CAP +20', reps: '20' },
      { teamCode: 2, time: '08:45' },
      { teamCode: 3, time: 'CAP +5', reps: '5' },
      { teamCode: 4, time: '09:59' },
    ]);
    expect(order(i)).toEqual(['2@1', '4@2', '3@3', '1@4']);
  });
});

describe('WOD 3 (Maximum Lift, max_load)', () => {
  const wod = { code: 104, title: 'WOD 3 — MAXIMUM LIFT', type: 'max_load', timeCap: '06:00' };

  it('maior carga da dupla vence; carga igual empata', () => {
    const i = input(wod, [
      { teamCode: 1, weight: '120kg' },
      { teamCode: 2, weight: '135' },
      { teamCode: 3, weight: '120' },
    ]);
    expect(order(i)).toEqual(['2@1', '1@2', '3@2']);
  });
});

describe('WOD 4-A / 4-B (Double Trouble, amrap 4\')', () => {
  const wod = { code: 105, title: 'WOD 4-A — DOUBLE TROUBLE (BLOCO A)', type: 'amrap', timeCap: '04:00' };

  it('mais reps vence ("45 reps" não é confundido com rounds)', () => {
    const i = input(wod, [
      { teamCode: 1, time: '45 reps', reps: '45' },
      { teamCode: 2, time: '62 reps', reps: '62' },
      { teamCode: 3, time: '45 reps', reps: '45' },
    ]);
    expect(order(i)).toEqual(['2@1', '1@2', '3@2']);
  });
});
