import { Board } from '../../src/modules/scoring/types';
import { buildScreenMessage, ScreenRecord } from '../../src/modules/screens/screen-message';

function board(code: string, name = `Campeonato ${code}`, marker = 'x'): Board {
  return {
    game: {
      code,
      name,
      location: marker,
      eventType: 'crossfit',
      rule: { mode: 'points', tiebreak: 'last-wod' } as never,
      totalUnit: 'PTS',
    },
    generatedAt: '2026-01-01T00:00:00.000Z',
    categories: [],
  };
}

function screen(over: Partial<ScreenRecord> = {}): ScreenRecord {
  return {
    id: 's1',
    name: 'Telão 1',
    mode: 'partial',
    rotateSeconds: 15,
    frozen: false,
    frozenAt: null,
    overlayText: null,
    frozenBoards: null,
    ...over,
  };
}

describe('buildScreenMessage', () => {
  it('não congelado usa os placares ao vivo', () => {
    const msg = buildScreenMessage(screen(), [board('A'), board('B')]);
    expect(msg.type).toBe('screen');
    expect(msg.boards.map((b) => b.game.code)).toEqual(['A', 'B']);
    expect(msg.screen.games).toEqual([
      { code: 'A', name: 'Campeonato A' },
      { code: 'B', name: 'Campeonato B' },
    ]);
    expect(msg.screen.frozen).toBe(false);
  });

  it('congelado usa SOMENTE a cópia, ignorando os placares ao vivo', () => {
    const msg = buildScreenMessage(
      screen({
        frozen: true,
        frozenAt: new Date('2026-02-02T10:00:00.000Z'),
        overlayText: 'CONGELADO',
        frozenBoards: [board('A', 'Antigo A', 'copia')],
      }),
      [board('A', 'Novo A', 'vivo'), board('C')],
    );
    expect(msg.boards).toHaveLength(1);
    expect(msg.boards[0].game.location).toBe('copia');
    expect(msg.screen.games).toEqual([{ code: 'A', name: 'Antigo A' }]);
    expect(msg.screen.frozenAt).toBe('2026-02-02T10:00:00.000Z');
    expect(msg.screen.overlayText).toBe('CONGELADO');
  });

  it('congelado sem cópia não vaza placar ao vivo', () => {
    const msg = buildScreenMessage(screen({ frozen: true, frozenBoards: null }), [board('A')]);
    expect(msg.boards).toEqual([]);
    expect(msg.screen.games).toEqual([]);
  });

  it('sem campeonatos efetivos devolve boards vazio', () => {
    const msg = buildScreenMessage(screen(), []);
    expect(msg.boards).toEqual([]);
    expect(msg.screen.games).toEqual([]);
  });

  it('ordena os campeonatos por código nos dois caminhos', () => {
    const vivo = buildScreenMessage(screen(), [board('C'), board('A'), board('B')]);
    expect(vivo.boards.map((b) => b.game.code)).toEqual(['A', 'B', 'C']);
    expect(vivo.screen.games.map((g) => g.code)).toEqual(['A', 'B', 'C']);
    const congelado = buildScreenMessage(screen({ frozen: true, frozenBoards: [board('B'), board('A')] }), []);
    expect(congelado.boards.map((b) => b.game.code)).toEqual(['A', 'B']);
  });

  it('congela apenas categorias específicas mantendo as demais ao vivo', () => {
    const liveA: Board = {
      ...board('A'),
      categories: [
        { id: 1, name: 'RX MASCULINO', wodTitles: ['WOD 1'], rows: [] },
        {
          id: 2,
          name: 'SCALED MASCULINO',
          wodTitles: ['WOD 1'],
          rows: [{ rank: 1, teamCode: 10, team: 'Ao Vivo Novo', number: '#10', athletes: [], status: 'active', totalPoints: 200, totalDisplay: '200', wods: [] }],
        },
      ],
    };
    const msg = buildScreenMessage(
      screen({
        frozen: false,
        frozenCategoriesMap: {
          'A:2': {
            gameCode: 'A',
            categoryId: 2,
            categoryName: 'SCALED MASCULINO',
            overlayText: 'CATEGORIA EM REVISÃO',
            frozenAt: '2026-03-01T12:00:00.000Z',
            snapshot: {
              id: 2,
              name: 'SCALED MASCULINO',
              wodTitles: ['WOD 1'],
              rows: [{ rank: 1, teamCode: 10, team: 'Snapshot Congelado', number: '#10', athletes: [], status: 'active', totalPoints: 100, totalDisplay: '100', wods: [] }],
            },
          },
        },
        spotlight: {
          kind: 'podium',
          gameCode: 'A',
          gameName: 'Campeonato A',
          categoryId: 1,
          categoryName: 'RX MASCULINO',
          revealStep: 3,
          autoAdvance: false,
          triggeredAt: '2026-03-01T12:05:00.000Z',
        },
      }),
      [liveA],
    );

    expect(msg.screen.frozen).toBe(false);
    expect(msg.screen.frozenCategories).toEqual([
      {
        gameCode: 'A',
        categoryId: 2,
        categoryName: 'SCALED MASCULINO',
        overlayText: 'CATEGORIA EM REVISÃO',
        frozenAt: '2026-03-01T12:00:00.000Z',
      },
    ]);
    expect(msg.screen.spotlight?.kind).toBe('podium');
    expect(msg.boards[0].categories[0].frozen).toBeUndefined();
    expect(msg.boards[0].categories[1].frozen).toBe(true);
    expect(msg.boards[0].categories[1].overlayText).toBe('CATEGORIA EM REVISÃO');
    expect(msg.boards[0].categories[1].rows[0].team).toBe('Snapshot Congelado');
  });
});
