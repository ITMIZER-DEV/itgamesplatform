import { computeWorkoutEntries } from '../../src/modules/scoring/engine';
import { buildPreviewRows, toSnapshotRows } from '../../src/modules/official/official-rows';
import { EngineInput } from '../../src/modules/scoring/types';

const input: EngineInput = {
  game: { code: 'G1', name: 'G1' },
  categories: [{ code: 1, name: 'RX' }],
  workouts: [{ code: 1, category: 1, title: 'WOD 1', type: 'for_time', timeCap: '10:00' }],
  teams: [
    { code: 101, categoryId: 1, team: 'A', number: '#1', athletes: ['a'], status: 'active' },
    { code: 102, categoryId: 1, team: 'B', number: null, athletes: ['b'], status: 'active' },
    { code: 103, categoryId: 1, team: 'C', number: '#3', athletes: ['c'], status: 'active' },
    { code: 104, categoryId: 1, team: 'D', number: '#4', athletes: ['d'], status: 'cancelled' },
    { code: 201, categoryId: 2, team: 'Outra', number: '#9', athletes: ['x'], status: 'active' },
  ],
  scores: [
    { workoutCode: 1, category: 1, teamCode: 101, time: '06:00' },
    { workoutCode: 1, category: 1, teamCode: 102, time: '05:00' },
  ],
};

describe('linhas do cálculo oficial', () => {
  const entries = computeWorkoutEntries(input, 1, 1);

  it('o instantâneo inclui todas as equipes da categoria, com W.O. e cancelada', () => {
    const rows = toSnapshotRows(input, 1, entries!);
    expect(rows.map((r) => r.teamCode)).toEqual([101, 102, 103, 104]);
    const wo = rows.find((r) => r.teamCode === 103)!;
    expect(wo.status).toBe('wo');
    expect(wo.rank).toBe(3);
    expect(rows.find((r) => r.teamCode === 104)!.status).toBe('cancelled');
    expect(rows.find((r) => r.teamCode === 102)!.rank).toBe(1);
  });

  it('a prévia ordena por colocação, deixa W.O. depois e cancelada por último', () => {
    const rows = buildPreviewRows(input, 1, entries);
    expect(rows.map((r) => r.teamCode)).toEqual([102, 101, 103, 104]);
    expect(rows[1].number).toBe('#1');
    expect(rows.find((r) => r.teamCode === 102)!.number).toBe('');
  });

  it('sem entradas, a prévia lista as equipes sem colocação', () => {
    const rows = buildPreviewRows(input, 1, null);
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.teamCode === 104)!.status).toBe('cancelled');
    expect(rows.find((r) => r.teamCode === 101)!.status).toBe('none');
  });
});
