import { BoardRows, toEngineInput } from '../../src/modules/scoring/board.service';

const rows = (over: Partial<BoardRows> = {}): BoardRows => ({
  game: { code: 'G1', name: 'Arena', location: 'SP', eventType: 'hyrox', scoringMode: 'total_time', tiebreak: 'split', pointsTable: [10, 8, 6] },
  categories: [{ code: 1, name: 'RX' }],
  workouts: [{ code: 10, category: 1, title: 'Fran', type: 'for_time', timeCap: '10:00' }],
  registrations: [
    { code: 1, categoryId: 1, team: 'Alfa', number: '101', status: 'paid', athletes: [{ name: 'Ana' }, { name: 'Bia' }] },
    { code: 2, categoryId: 1, team: 'Beta', number: null, status: 'cancelled', athletes: [{ name: 'Caio' }] },
    { code: 3, categoryId: 1, team: 'Gama', number: '103', status: null, athletes: [] },
  ],
  scores: [{ idEvent: 10, category: 1, codeTeam: 1, time: '05:00', scoreStatus: 'approved_by_head_judge' }],
  ...over,
});

describe('toEngineInput', () => {
  it('inscrição cancelada vira status cancelled; demais ficam active', () => {
    const { teams } = toEngineInput(rows());
    expect(teams.map((t) => t.status)).toEqual(['active', 'cancelled', 'active']);
  });

  it('atletas viram lista de nomes', () => {
    expect(toEngineInput(rows()).teams[0].athletes).toEqual(['Ana', 'Bia']);
  });

  it('idEvent vira workoutCode e codeTeam vira teamCode', () => {
    const [s] = toEngineInput(rows()).scores;
    expect(s.workoutCode).toBe(10);
    expect(s.teamCode).toBe(1);
    expect(s.time).toBe('05:00');
  });

  it('score voided vira voided:true; os demais, false', () => {
    const base = { idEvent: 10, category: 1, codeTeam: 1, time: '05:00' };
    const { scores } = toEngineInput(
      rows({ scores: [{ ...base, scoreStatus: 'voided' }, { ...base, codeTeam: 3, scoreStatus: 'approved' }] }),
    );
    expect(scores.map((s) => s.voided)).toEqual([true, false]);
  });

  it('status válidos entram (inclusive nulo); draft é excluído', () => {
    const base = { idEvent: 10, category: 1, time: '05:00' };
    const statuses = ['approved_by_head_judge', 'approved', 'submitted_by_judge', 'contested', null, 'draft'];
    const { scores } = toEngineInput(
      rows({ scores: statuses.map((scoreStatus, i) => ({ ...base, codeTeam: i + 1, scoreStatus })) }),
    );
    expect(scores.map((s) => s.teamCode)).toEqual([1, 2, 3, 4, 5]);
  });

  it('pointsTable, regra e parciais passam adiante', () => {
    const input = toEngineInput(
      rows({
        scores: [
          { idEvent: 10, category: 1, codeTeam: 1, scoreStatus: null, splits: [{ name: 'Run 1', seconds: 300 }, { x: 1 }] },
          { idEvent: 10, category: 1, codeTeam: 2, scoreStatus: null, splits: null },
        ],
      }),
    );
    expect(input.game.pointsTable).toEqual([10, 8, 6]);
    expect(input.game.scoringMode).toBe('total_time');
    expect(input.game.tiebreak).toBe('split');
    expect(input.scores[0].splits).toEqual([{ name: 'Run 1', seconds: 300 }]);
    expect(input.scores[1].splits).toBeNull();
  });
});
