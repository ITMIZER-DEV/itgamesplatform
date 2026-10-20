// Visões do placar: parcial (sem pontos) e oficial. Funções puras que devolvem cópias.
import { Board } from './types';

/** Placar público antes da confirmação: ordem e posições preservadas, pontos e totais zerados. */
export function toPartialBoard(board: Board): Board {
  return {
    ...board,
    game: { ...board.game, pointsVisible: false, view: 'partial' },
    categories: board.categories.map((c) => ({
      ...c,
      rows: c.rows.map((r) => ({
        ...r,
        totalPoints: 0,
        totalDisplay: '',
        wods: r.wods.map((w) => ({ ...w, points: 0 })),
      })),
    })),
  };
}

/** Marca o placar como oficial (pontos visíveis); `awaitingOfficial` quando nada foi confirmado. */
export function markOfficial(board: Board): Board {
  return {
    ...board,
    game: {
      ...board.game,
      pointsVisible: true,
      view: 'official',
      awaitingOfficial: board.categories.length === 0,
    },
  };
}
