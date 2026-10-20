import { buildBoard, computeBoard, computeWorkoutEntries, EntriesProvider } from '../../src/modules/scoring/engine';
import { Board, EngineInput, EngineScore } from '../../src/modules/scoring/types';
import { markOfficial, toPartialBoard } from '../../src/modules/scoring/visibility';

const NOW = new Date('2026-10-19T12:00:00.000Z');

function team(code: number, status: 'active' | 'cancelled' = 'active') {
  return { code, categoryId: 1, team: `Equipe ${code}`, number: `${code}`, athletes: [`Atleta ${code}`], status };
}

function score(workoutCode: number, teamCode: number, extra: Partial<EngineScore>): EngineScore {
  return { workoutCode, category: 1, teamCode, ...extra };
}

// Fixture A: categoria 1; WOD 10 for_time cap 10:00, WOD 11 max_load; equipes 1–4 (a 4 é W.O.; 2 e 3 empatam)
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

function fixtureHyrox(): EngineInput {
  return fixtureA(
    {
      workouts: [{ code: 10, category: 1, title: 'Prova', type: 'hyrox_standard' }],
      scores: [
        score(10, 1, { time: '60:00' }),
        score(10, 2, { time: '55:00' }),
        score(10, 3, { time: '58:00' }),
        score(10, 4, { isWO: true }),
      ],
    },
    { eventType: 'hyrox', scoringMode: 'total_time' },
  );
}

const providerOf =
  (input: EngineInput): EntriesProvider =>
  (c, w) =>
    computeWorkoutEntries(input, c, w);

describe('buildBoard', () => {
  it('com o provider padrão equivale a computeBoard', () => {
    const input = fixtureA();
    expect(buildBoard(input, providerOf(input), NOW)).toEqual(computeBoard(input, NOW));
  });

  it('WOD sem entradas fica none, sem pontos e fora do total e do desempate last_workout', () => {
    const input = fixtureA();
    const only10: EntriesProvider = (c, w) => (w === 10 ? computeWorkoutEntries(input, c, w) : null);
    const rows = buildBoard(input, only10, NOW).categories[0].rows;
    for (const r of rows) {
      expect(r.wods[1]).toMatchObject({ status: 'none', points: 0 });
    }
    const t = (code: number) => rows.find((r) => r.teamCode === code)!;
    // só o WOD 10 conta: 95, 100, 100, 90
    expect([1, 2, 3, 4].map((c) => t(c).totalPoints)).toEqual([95, 100, 100, 90]);
    // desempate pelo último WOD que conta (o 10): 2 e 3 seguem empatados em 1º
    expect(rows.map((r) => r.teamCode)).toEqual([2, 3, 1, 4]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 2, 3]);
  });
});

describe('toPartialBoard', () => {
  it('zera pontos e totais, preserva ordem e rank e não altera o original', () => {
    const board = computeBoard(fixtureA(), NOW);
    const snapshot = JSON.parse(JSON.stringify(board));
    const partial = toPartialBoard(board);

    expect(board).toEqual(snapshot);
    expect(partial.game.pointsVisible).toBe(false);
    expect(partial.game.view).toBe('partial');
    const orig = board.categories[0].rows;
    const rows = partial.categories[0].rows;
    expect(rows.map((r) => r.teamCode)).toEqual(orig.map((r) => r.teamCode));
    expect(rows.map((r) => r.rank)).toEqual(orig.map((r) => r.rank));
    expect(rows.map((r) => r.wods.map((w) => w.rank))).toEqual(orig.map((r) => r.wods.map((w) => w.rank)));
    expect(rows.map((r) => r.wods.map((w) => w.display))).toEqual(orig.map((r) => r.wods.map((w) => w.display)));
    expect(rows.map((r) => r.wods.map((w) => w.status))).toEqual(orig.map((r) => r.wods.map((w) => w.status)));
    for (const r of rows) {
      expect(r.totalPoints).toBe(0);
      expect(r.totalDisplay).toBe('');
      for (const w of r.wods) expect(w.points).toBe(0);
    }
  });

  it('em total_time (HYROX) limpa o tempo total e preserva a ordem', () => {
    const input = fixtureHyrox();
    const board = computeBoard(input, NOW);
    expect(board.categories[0].rows[0].totalPoints).toBeGreaterThan(0);
    expect(board.categories[0].rows[0].totalDisplay).not.toBe('');
    const partial = toPartialBoard(board);
    expect(partial.categories[0].rows.map((r) => r.teamCode)).toEqual(board.categories[0].rows.map((r) => r.teamCode));
    expect(partial.categories[0].rows.map((r) => r.rank)).toEqual(board.categories[0].rows.map((r) => r.rank));
    for (const r of partial.categories[0].rows) {
      expect(r.totalPoints).toBe(0);
      expect(r.totalDisplay).toBe('');
    }
    expect(partial.game.pointsVisible).toBe(false);
    expect(partial.game.view).toBe('partial');
  });
});

describe('markOfficial', () => {
  it('marca awaitingOfficial só quando não há categorias', () => {
    const input = fixtureA();
    const full = computeBoard(input, NOW);
    const ok = markOfficial(full);
    expect(ok.game).toMatchObject({ pointsVisible: true, view: 'official', awaitingOfficial: false });
    expect(full.game.view).toBeUndefined();

    const empty: Board = { ...full, categories: [] };
    expect(markOfficial(empty).game.awaitingOfficial).toBe(true);
  });
});

describe('computeWorkoutEntries', () => {
  it('devolve null quando o WOD não tem súmula válida ou não existe na categoria', () => {
    const input = fixtureA({ scores: [score(10, 4, { isWO: true })] });
    expect(computeWorkoutEntries(input, 1, 10)).toBeNull();
    expect(computeWorkoutEntries(input, 1, 11)).toBeNull();
    expect(computeWorkoutEntries(input, 1, 999)).toBeNull();
  });

  it('inclui todas as equipes, com W.O. em último + 1', () => {
    const entries = computeWorkoutEntries(fixtureA(), 1, 10)!;
    expect([...entries.keys()].sort()).toEqual([1, 2, 3, 4]);
    expect(entries.get(2)).toMatchObject({ rank: 1, points: 100, status: 'scored' });
    expect(entries.get(1)).toMatchObject({ rank: 2, status: 'scored' });
    expect(entries.get(4)).toMatchObject({ rank: 3, points: 90, status: 'wo', display: 'W.O.' });
  });
});
