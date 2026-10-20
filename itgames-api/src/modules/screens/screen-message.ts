import { Board } from '../scoring/types';
import { ScreenMode } from './screens-logic';

export type ScreenRecord = {
  id: string;
  name: string;
  mode: ScreenMode;
  rotateSeconds: number;
  frozen: boolean;
  frozenAt: Date | null;
  overlayText: string | null;
  frozenBoards: Board[] | null;
};

export type ScreenMessage = {
  type: 'screen';
  screen: {
    id: string;
    name: string;
    mode: ScreenMode;
    rotateSeconds: number;
    frozen: boolean;
    frozenAt: string | null;
    overlayText: string | null;
    games: { code: string; name: string }[];
  };
  boards: Board[];
};

// Puro. Telão congelado usa SOMENTE a cópia gravada: os placares ao vivo são ignorados.
export function buildScreenMessage(screen: ScreenRecord, liveBoards: Board[]): ScreenMessage {
  const source = screen.frozen ? (screen.frozenBoards ?? []) : liveBoards;
  // Ordem determinística por código (o jsonb reordena chaves e o banco não garante ordem)
  const boards = [...source].sort((a, b) => (a.game.code < b.game.code ? -1 : a.game.code > b.game.code ? 1 : 0));
  return {
    type: 'screen',
    screen: {
      id: screen.id,
      name: screen.name,
      mode: screen.mode,
      rotateSeconds: screen.rotateSeconds,
      frozen: screen.frozen,
      frozenAt: screen.frozenAt ? screen.frozenAt.toISOString() : null,
      overlayText: screen.overlayText,
      games: boards.map((b) => ({ code: b.game.code, name: b.game.name })),
    },
    boards,
  };
}
