// WOD 2 (Sync & Burn): For Time com cap de 10:00. Quem termina vence pelo menor tempo;
// quem não termina toma CAP + reps faltantes (menos reps faltantes fica na frente).
// Desempate: tempo ao terminar a Air Bike; tempo não anotado perde para tempo anotado.
import { computeBoard } from '../../src/modules/scoring/engine';
import { EngineInput, EngineScore } from '../../src/modules/scoring/types';

const NOW = new Date('2026-11-26T12:00:00.000Z');
const team = (code: number) => ({ code, categoryId: 1, team: `Dupla ${code}`, number: `${code}`, athletes: [], status: 'active' as const });
const score = (teamCode: number, extra: Partial<EngineScore>): EngineScore => ({ workoutCode: 603, category: 1, teamCode, ...extra });

function board(scores: EngineScore[]) {
  const input: EngineInput = {
    game: { code: 'G', name: 'Summer', location: 'Arena', eventType: 'crossfit' },
    categories: [{ code: 1, name: 'AMADOR' }],
    workouts: [{ code: 603, category: 1, title: 'WOD 2 — SYNC & BURN', type: 'for_time', timeCap: '10:00' }],
    teams: [1, 2, 3, 4, 5, 6].map(team),
    scores,
  };
  const rows = computeBoard(input, NOW).categories[0].rows;
  return Object.fromEntries(rows.map((r: any) => [r.teamCode ?? r.team?.code ?? r.code, { rank: r.wods[0].rank, display: r.wods[0].display }]));
}

describe('WOD 2 — For Time com CAP + reps faltantes', () => {
  const res = board([
    score(1, { time: '07:30', tieBreakTime: '03:10' }),
    score(2, { time: '08:05' }),
    score(3, { time: '07:30', tieBreakTime: '03:00' }),
    score(4, { time: '10:00', reps: '12' }),
    score(5, { time: '10:00', reps: '5' }),
    score(6, { time: '10:00', reps: '5', tieBreakTime: '04:00' }),
  ]);

  it('quem termina fica na frente, pelo menor tempo; empate no tempo vai para o tie-break', () => {
    expect(res[3]).toEqual({ rank: 1, display: '07:30' });
    expect(res[1]).toEqual({ rank: 2, display: '07:30' });
    expect(res[2]).toEqual({ rank: 3, display: '08:05' });
  });

  it('quem não termina toma CAP + reps faltantes; menos reps faltantes fica na frente', () => {
    expect(res[6]).toEqual({ rank: 4, display: 'CAP +5' });
    expect(res[5]).toEqual({ rank: 5, display: 'CAP +5' });
    expect(res[4]).toEqual({ rank: 6, display: 'CAP +12' });
  });
});
