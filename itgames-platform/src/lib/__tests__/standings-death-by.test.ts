import { describe, expect, it } from 'vitest';
import { computeWorkoutRanking, readRoundsResult } from '@/lib/standings-engine';

// Cenário real do 1-B Iniciante: o campo reps guarda só as reps extras; os rounds estão no texto.
const wod = { id: '102', categoryId: '2', title: 'WOD 1-B — DEATH BY', type: 'amrap', timeCapSeconds: 1260 } as any;
const team = (code: number, status = 'paid') =>
  ({ id: String(code), categoryId: '2', teamName: `Dupla ${code}`, paymentStatus: status, athletes: [] }) as any;
const score = (code: number, time: string, reps?: number, tieBreak?: string) =>
  ({ id: `s${code}`, workoutId: '102', registrationId: String(code), timeFormatted: time, repsCount: reps, tieBreakTimeFormatted: tieBreak, isCompleted: true, isWO: false, isDisqualified: false }) as any;

describe('WOD 1-B (Death By): rounds → reps → menor tempo', () => {
  const teams = [2530, 2875, 2512, 2732, 2629, 2514, 2152, 9999].map((c) => team(c, c === 9999 ? 'cancelled' : 'paid'));
  const scores = [
    score(2530, '2R + 24 reps (04:39 | R1 02:29, R2 02:10)', 24),
    score(2875, '5R (12:19 | R1 02:55, R2 02:10, R3 02:10, R4 02:29, R5 02:35)', 0),
    score(2512, '5R (12:38 | R1 02:40, R2 02:37, R3 02:21, R4 02:01, R5 02:59)', 0),
    score(2732, '4R + 9 reps (10:58 | R1 02:46, R2 02:34, R3 02:40, R4 02:58)', 9),
    score(2629, '4 Rds + 12 reps', 12, '10:40'),
    score(2514, '1 Rds + 20 reps', 20, '02:57'),
    score(2152, '5 Rounds (11:58)', undefined, '11:58'),
    score(9999, '5R (10:00)', 0),
  ];
  const { rows } = computeWorkoutRanking(wod, teams, scores);

  it('quem fecha mais rounds fica na frente, independente das reps extras', () => {
    expect(rows.map((r) => r.team.id)).toEqual(['2152', '2875', '2512', '2629', '2732', '2530', '2514']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('inscrição cancelada não entra', () => {
    expect(rows.some((r) => r.team.id === '9999')).toBe(false);
  });

  it('lê rounds, reps extras e tempo de qualquer formato', () => {
    expect(readRoundsResult(score(1, '3 Rds + 12 reps', undefined))).toEqual({ rounds: 3, reps: 12, tieBreakSeconds: 0 });
    expect(readRoundsResult(score(1, '5R (12:19 | R1 02:55)', 0))).toEqual({ rounds: 5, reps: 0, tieBreakSeconds: 739 });
  });
});

describe('parseKg', () => {
  it('lê carga com decimal e unidade sem multiplicar', async () => {
    const { parseKg } = await import('@/lib/standings-engine');
    expect(['147.5kg', '145', '92,5 kg', 190, '', null].map(parseKg)).toEqual([147.5, 145, 92.5, 190, undefined, undefined]);
  });
});
