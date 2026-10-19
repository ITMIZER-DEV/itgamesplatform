import { buildBoard, BoardSource, formatTime } from '../src/modules/leaderboard/board';

const source = (): BoardSource => ({
  game: { code: 'G1', name: 'Arena', eventType: 'crossfit', location: 'SP' },
  categories: [{ code: 1, name: 'RX' }],
  workouts: [
    { code: 10, category: 1, title: 'Fran', type: 'for_time', timeCap: '10:00' },
    { code: 11, category: 1, title: 'Deadlift', type: 'max_load' },
  ],
  teams: [
    { code: 1, categoryId: 1, team: 'Alfa', number: '101', athletes: ['A'] },
    { code: 2, categoryId: 1, team: 'Beta', number: '102', athletes: ['B'] },
    { code: 3, categoryId: 1, team: 'Gama', number: null, athletes: ['C'] },
  ],
  scores: [
    { idEvent: 10, category: 1, codeTeam: 1, time: '05:30' },
    { idEvent: 10, category: 1, codeTeam: 2, time: '04:10' },
    { idEvent: 10, category: 1, codeTeam: 3, isWO: true },
    { idEvent: 11, category: 1, codeTeam: 1, weight: '150' },
    { idEvent: 11, category: 1, codeTeam: 2, weight: '140' },
  ],
});

describe('buildBoard', () => {
  it('ordena por pontos somados e calcula a posição em cada WOD', () => {
    const [cat] = buildBoard(source()).categories;
    // empate em 195: vence quem foi melhor no último WOD
    expect(cat.rows.map((r) => r.team)).toEqual(['Alfa', 'Beta', 'Gama']);
    expect(cat.rows[0]).toMatchObject({ rank: 1, totalPoints: 195 });
    expect(cat.rows[1]).toMatchObject({ rank: 2, totalPoints: 195 });
  });

  it('formata tempo, W.O., equipe sem lançamento e número padrão', () => {
    const rows = buildBoard(source()).categories[0].rows;
    expect(rows[1].wods[0]).toMatchObject({ display: '04:10', rank: 1, points: 100 });
    expect(rows[2].wods[0]).toMatchObject({ display: 'W.O.', points: 0 });
    expect(rows[2].wods[1]).toMatchObject({ display: 'Sem Score', rank: 0 });
    expect(rows[2].number).toBe('#3');
  });

  it('HYROX ordena pelo menor tempo total', () => {
    const data = source();
    data.game.eventType = 'hyrox';
    expect(buildBoard(data).categories[0].rows.map((r) => r.team)).toEqual(['Beta', 'Alfa', 'Gama']);
  });

  it('apara espaços sobrando em nomes de equipe e atletas', () => {
    const data = source();
    data.teams[0] = { ...data.teams[0], team: ' Alfa ', athletes: ['Ana ', ' '] };
    const row = buildBoard(data).categories[0].rows.find((r) => r.number === '101')!;
    expect(row.team).toBe('Alfa');
    expect(row.athletes).toEqual(['Ana']);
  });

  it('formatTime', () => {
    expect(formatTime(65.5)).toBe('01:05.5');
  });
});
