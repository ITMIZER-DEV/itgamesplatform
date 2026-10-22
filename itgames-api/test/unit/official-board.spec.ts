import { BoardRows } from '../../src/modules/scoring/board.service';
import { buildOfficialBoard, ConfirmedResult } from '../../src/modules/scoring/official-board';

const NOW = new Date('2026-10-20T12:00:00.000Z');

function rows(gameExtra: Partial<BoardRows['game']> = {}, extra: Partial<BoardRows> = {}): BoardRows {
  return {
    game: { code: 'G1', name: 'Campeonato', location: 'Arena', eventType: 'crossfit', ...gameExtra },
    categories: [
      { code: 1, name: 'RX' },
      { code: 2, name: 'Scaled' },
    ],
    workouts: [
      { code: 10, category: 1, title: 'WOD 1', type: 'for_time', timeCap: '10:00' },
      { code: 11, category: 1, title: 'WOD 2', type: 'max_load' },
      { code: 12, category: 2, title: 'WOD 1', type: 'for_time', timeCap: '10:00' },
    ],
    registrations: [
      { code: 1, categoryId: 1, team: 'A', number: '1', athletes: [{ name: 'a' }] },
      { code: 2, categoryId: 1, team: 'B', number: '2', athletes: [{ name: 'b' }] },
      { code: 3, categoryId: 2, team: 'C', number: '3', athletes: [{ name: 'c' }] },
    ],
    // súmulas mudaram depois da confirmação: o instantâneo deve vencer
    scores: [
      { idEvent: 10, category: 1, codeTeam: 1, time: '01:00' },
      { idEvent: 10, category: 1, codeTeam: 2, time: '09:00' },
    ],
    ...extra,
  };
}

const confirmed1: ConfirmedResult = {
  categoryId: 1,
  eventId: 10,
  rows: [
    { teamCode: 2, rank: 1, points: 1, display: '04:00', status: 'scored' },
    { teamCode: 1, rank: 2, points: 2, display: '05:00', status: 'scored' },
  ],
};

describe('buildOfficialBoard', () => {
  it('usa só categorias com WOD confirmado, marca oficial e deixa o instantâneo vencer', () => {
    const b = buildOfficialBoard(rows({ scoringMode: 'rank_sum' }), [confirmed1], NOW);
    expect(b.categories.map((c) => c.id)).toEqual([1]);
    expect(b.game.view).toBe('official');
    expect(b.game.pointsVisible).toBe(true);
    expect(b.game.awaitingOfficial).toBe(false);
    const cat = b.categories[0];
    expect(cat.rows.map((r) => r.teamCode)).toEqual([2, 1]);
    expect(cat.rows[0].totalPoints).toBe(1);
    expect(cat.rows[1].totalPoints).toBe(2);
    // WOD 11 não confirmado: none e não soma
    expect(cat.rows[0].wods[1]).toMatchObject({ status: 'none', display: 'Sem Score', points: 0 });
  });

  it('sem nada confirmado: categories [] e awaitingOfficial', () => {
    const b = buildOfficialBoard(rows(), [], NOW);
    expect(b.categories).toEqual([]);
    expect(b.game.awaitingOfficial).toBe(true);
    expect(b.game.pointsVisible).toBe(true);
  });

  it('ignora linhas de equipes que não existem mais', () => {
    const c: ConfirmedResult = {
      ...confirmed1,
      rows: [...confirmed1.rows, { teamCode: 99, rank: 3, points: 3, display: '06:00', status: 'scored' }],
    };
    const b = buildOfficialBoard(rows(), [c], NOW);
    expect(b.categories[0].rows.map((r) => r.teamCode).sort()).toEqual([1, 2]);
  });

  it('equipe inscrita depois da confirmação aparece como Sem Score, não W.O.', () => {
    const r = rows();
    r.registrations.push({ code: 4, categoryId: 1, team: 'D', number: '4', athletes: [{ name: 'd' }] });
    const b = buildOfficialBoard(r, [confirmed1], NOW);
    const d = b.categories[0].rows.find((x) => x.teamCode === 4)!;
    expect(d.wods[0]).toMatchObject({ status: 'none', display: 'Sem Score', points: 0 });
    expect(d.totalPoints).toBe(0);
  });

  it('W.O. do instantâneo mantém posição e pontos gravados', () => {
    const c: ConfirmedResult = {
      categoryId: 1,
      eventId: 10,
      rows: [
        { teamCode: 1, rank: 1, points: 1, display: '05:00', status: 'scored' },
        { teamCode: 2, rank: 2, points: 2, display: 'W.O.', status: 'wo' },
      ],
    };
    const b = buildOfficialBoard(rows(), [c], NOW);
    const w = b.categories[0].rows.find((x) => x.teamCode === 2)!.wods[0];
    expect(w).toMatchObject({ status: 'wo', rank: 2, points: 2, display: 'W.O.' });
  });

  it('HYROX usa seconds e splits do instantâneo para total e desempate', () => {
    const r = rows(
      { eventType: 'hyrox', scoringMode: 'total_time', tiebreak: 'split:Run' },
      {
        categories: [{ code: 1, name: 'RX' }],
        workouts: [{ code: 10, category: 1, title: 'Prova', type: 'hyrox_standard' }],
        scores: [],
      },
    );
    const c: ConfirmedResult = {
      categoryId: 1,
      eventId: 10,
      rows: [
        { teamCode: 1, rank: 1, points: 0, display: '60:00', status: 'scored', seconds: 3600, splits: [{ name: 'Run', seconds: 500 }] },
        { teamCode: 2, rank: 1, points: 0, display: '60:00', status: 'scored', seconds: 3600, splits: [{ name: 'Run', seconds: 400 }] },
      ],
    };
    const b = buildOfficialBoard(r, [c], NOW);
    const cat = b.categories[0];
    expect(cat.rows.map((x) => x.teamCode)).toEqual([2, 1]);
    expect(cat.rows[0].totalPoints).toBe(3600);
    expect(cat.rows[0].rank).toBe(1);
    expect(cat.rows[1].rank).toBe(2);
  });
});
