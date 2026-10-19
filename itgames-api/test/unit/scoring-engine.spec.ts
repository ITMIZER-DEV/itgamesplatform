import { computeBoard } from '../../src/modules/scoring/engine';
import { EngineInput, EngineScore } from '../../src/modules/scoring/types';

const NOW = new Date('2026-10-19T12:00:00.000Z');

function team(code: number, status: 'active' | 'cancelled' = 'active') {
  return { code, categoryId: 1, team: `Equipe ${code}`, number: `${code}`, athletes: [`Atleta ${code}`], status };
}

function score(workoutCode: number, teamCode: number, extra: Partial<EngineScore>): EngineScore {
  return { workoutCode, category: 1, teamCode, ...extra };
}

// Fixture A: categoria 1; WOD 10 for_time cap 10:00, WOD 11 max_load; equipes 1–4 ativas
function fixtureA(overrides: Partial<EngineInput> = {}, gameExtra: Partial<EngineInput['game']> = {}): EngineInput {
  return {
    game: { code: 'G1', name: 'Campeonato', location: 'Arena', eventType: 'crossfit', ...gameExtra },
    categories: [{ code: 1, name: 'RX' }],
    workouts: [
      { code: 10, category: 1, title: 'WOD 1', type: 'for_time', timeCap: '10:00' },
      { code: 11, category: 1, title: 'WOD 2', type: 'max_load' },
    ],
    teams: [team(1), team(2), team(3), team(4)],
    scores: [
      score(10, 1, { time: '05:00' }),
      score(10, 2, { time: '04:00' }),
      score(10, 3, { time: '04:00' }),
      score(10, 4, { isWO: true }),
      score(11, 1, { weight: '150' }),
      score(11, 2, { weight: '140' }),
      score(11, 3, { weight: '140' }),
    ],
    ...overrides,
  };
}

function rowsOf(input: EngineInput) {
  return computeBoard(input, NOW).categories[0].rows;
}

function byTeam(input: EngineInput) {
  const rows = rowsOf(input);
  return (code: number) => rows.find((r) => r.teamCode === code)!;
}

describe('computeBoard — pontos por posição (points_table)', () => {
  it('calcula posições densas e pontos por WOD, com W.O. e sem score em último + 1', () => {
    const t = byTeam(fixtureA());
    expect([1, 2, 3, 4].map((c) => t(c).wods[0].rank)).toEqual([2, 1, 1, 3]);
    expect([1, 2, 3, 4].map((c) => t(c).wods[0].points)).toEqual([95, 100, 100, 90]);
    expect([1, 2, 3, 4].map((c) => t(c).wods[1].rank)).toEqual([1, 2, 2, 3]);
    expect([1, 2, 3, 4].map((c) => t(c).wods[1].points)).toEqual([100, 95, 95, 90]);
    expect([1, 2, 3, 4].map((c) => t(c).totalPoints)).toEqual([195, 195, 195, 180]);
  });

  it('exibe o resultado conforme o tipo do WOD e marca W.O.', () => {
    const t = byTeam(fixtureA());
    expect(t(2).wods[0]).toMatchObject({ title: 'WOD 1', display: '04:00', status: 'scored' });
    expect(t(1).wods[1]).toMatchObject({ title: 'WOD 2', display: '150 kg', status: 'scored' });
    expect(t(4).wods[0]).toMatchObject({ display: 'W.O.', status: 'wo' });
    expect(t(4).wods[1].status).toBe('wo');
    expect(t(1).totalDisplay).toBe('195');
  });

  it('desempata pelo último WOD (last_workout)', () => {
    const rows = rowsOf(fixtureA());
    expect(rows.map((r) => r.teamCode)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 3]);
  });

  it('com most_wins, as três equipes com uma vitória empatam em 1º', () => {
    const rows = rowsOf(fixtureA({}, { tiebreak: 'most_wins' }));
    expect(rows.map((r) => r.teamCode)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1, 2]);
  });

  it('preenche os metadados do placar', () => {
    const board = computeBoard(fixtureA(), NOW);
    expect(board.generatedAt).toBe(NOW.toISOString());
    expect(board.game).toEqual({
      code: 'G1',
      name: 'Campeonato',
      location: 'Arena',
      eventType: 'crossfit',
      rule: { mode: 'points_table', tiebreak: 'last_workout' },
      totalUnit: 'PTS',
    });
    expect(board.categories[0]).toMatchObject({ id: 1, name: 'RX', wodTitles: ['WOD 1', 'WOD 2'] });
  });
});

describe('computeBoard — soma de posições (rank_sum)', () => {
  it('soma as posições e o menor total vence', () => {
    const input = fixtureA({}, { scoringMode: 'rank_sum' });
    const board = computeBoard(input, NOW);
    const rows = board.categories[0].rows;
    const t = (c: number) => rows.find((r) => r.teamCode === c)!;
    expect([1, 2, 3, 4].map((c) => t(c).totalPoints)).toEqual([3, 3, 3, 6]);
    expect(t(4).wods.map((w) => w.points)).toEqual([3, 3]);
    expect(rows.map((r) => r.teamCode)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 3]);
    expect(board.game.totalUnit).toBe('SOMA');
    expect(board.game.rule.mode).toBe('rank_sum');
  });
});

describe('computeBoard — equipe cancelada', () => {
  it('continua na lista marcada como CANCELADA e fica em último + 1', () => {
    const input = fixtureA({ teams: [team(1), team(2), team(3, 'cancelled'), team(4)] });
    const t = byTeam(input);
    expect(rowsOf(input)).toHaveLength(4);
    expect(t(3).status).toBe('cancelled');
    expect(t(3).wods.map((w) => w.status)).toEqual(['cancelled', 'cancelled']);
    expect(t(3).wods.map((w) => w.display)).toEqual(['CANCELADA', 'CANCELADA']);
    expect(t(3).wods.map((w) => w.rank)).toEqual([3, 3]);
    expect(t(1).wods.map((w) => w.rank)).toEqual([2, 1]);
    expect(t(2).wods.map((w) => w.rank)).toEqual([1, 2]);
    expect(t(4).wods.map((w) => w.rank)).toEqual([3, 3]);
  });

  it('trata score voided como cancelado, não como resultado', () => {
    const input = fixtureA();
    input.scores = input.scores.map((s) => (s.teamCode === 3 ? { ...s, voided: true } : s));
    const t = byTeam(input);
    expect(t(3).wods.map((w) => w.status)).toEqual(['cancelled', 'cancelled']);
    expect(t(3).wods.map((w) => w.rank)).toEqual([3, 3]);
    expect(t(2).wods[0].rank).toBe(1);
  });
});

describe('computeBoard — casos de borda', () => {
  it('categoria sem equipes devolve rows vazio', () => {
    const board = computeBoard(fixtureA({ teams: [], scores: [] }), NOW);
    expect(board.categories[0].rows).toEqual([]);
  });

  it('WOD em que todas as equipes são W.O. não conta para ninguém', () => {
    const input = fixtureA();
    input.scores = input.scores.map((s) => (s.workoutCode === 10 ? { workoutCode: 10, category: 1, teamCode: s.teamCode, isWO: true } : s));
    const rows = rowsOf(input);
    for (const r of rows) {
      expect(r.wods[0]).toMatchObject({ status: 'none', display: 'Sem Score', points: 0 });
    }
    const t = (c: number) => rows.find((r) => r.teamCode === c)!;
    expect([1, 2, 3, 4].map((c) => t(c).totalPoints)).toEqual([100, 95, 95, 90]);
  });

  it('WOD sem nenhum score fica fora do total', () => {
    const input = fixtureA();
    input.scores = input.scores.filter((s) => s.workoutCode !== 11);
    const rows = rowsOf(input);
    for (const r of rows) {
      expect(r.wods[1]).toMatchObject({ status: 'none', display: 'Sem Score', points: 0 });
    }
    const t = (c: number) => rows.find((r) => r.teamCode === c)!;
    expect([1, 2, 3, 4].map((c) => t(c).totalPoints)).toEqual([95, 100, 100, 90]);
  });

  it('duas equipes idênticas em tudo têm a mesma posição e ficam em ordem de código', () => {
    const input = fixtureA({
      teams: [team(7), team(5)],
      scores: [
        score(10, 7, { time: '04:00' }),
        score(10, 5, { time: '04:00' }),
        score(11, 7, { weight: '140' }),
        score(11, 5, { weight: '140' }),
      ],
    });
    const rows = rowsOf(input);
    expect(rows.map((r) => r.teamCode)).toEqual([5, 7]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
    expect(rows.map((r) => r.totalPoints)).toEqual([200, 200]);
  });

  it('onlyWorkouts ignora os WODs fora do conjunto', () => {
    const rows = rowsOf(fixtureA({ onlyWorkouts: new Set([10]) }));
    const t = (c: number) => rows.find((r) => r.teamCode === c)!;
    expect(t(1).wods[1]).toMatchObject({ status: 'none', display: 'Sem Score', points: 0 });
    expect([1, 2, 3, 4].map((c) => t(c).totalPoints)).toEqual([95, 100, 100, 90]);
  });

  it('total_time ainda não é suportado', () => {
    expect(() => computeBoard(fixtureA({}, { eventType: 'hyrox' }), NOW)).toThrow('modo não suportado');
  });
});
