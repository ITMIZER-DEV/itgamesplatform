import { Board } from '../scoring/types';
import { ScreenMode } from './screens-logic';

export interface FrozenCategoryMeta {
  gameCode: string;
  categoryId: number;
  categoryName: string;
  overlayText: string;
  frozenAt: string;
  snapshot?: Board['categories'][number];
}

export type FrozenCategorySummary = Omit<FrozenCategoryMeta, 'snapshot'>;

export interface HeatCallLane {
  laneNumber: number;
  teamCode: number;
  teamName: string;
  number: string;
  athletes: string[];
  rank?: number;
  totalDisplay?: string;
}

export interface HeatCallSpotlight {
  kind: 'heat_call';
  gameCode: string;
  gameName: string;
  categoryId: number;
  categoryName: string;
  workoutCode?: number;
  workoutTitle: string;
  heatNumber: number;
  totalHeats: number;
  startTime: string;
  message?: string;
  lanes: HeatCallLane[];
  triggeredAt: string;
}

export interface PodiumSpotlight {
  kind: 'podium';
  gameCode: string;
  gameName: string;
  categoryId: number;
  categoryName: string;
  revealStep: number; // 1 = 3º lugar, 2 = 2º e 3º lugar, 3 = Pódio Completo (1º, 2º e 3º)
  autoAdvance: boolean;
  triggeredAt: string;
}

export type ScreenSpotlight = HeatCallSpotlight | PodiumSpotlight;

export interface ScreenStateEnvelope {
  __meta: true;
  boards?: Record<string, Board>;
  frozenCategories?: Record<string, FrozenCategoryMeta>;
  spotlight?: ScreenSpotlight | null;
}

export function parseScreenEnvelope(raw: unknown): ScreenStateEnvelope {
  if (!raw || typeof raw !== 'object') {
    return { __meta: true, boards: {}, frozenCategories: {}, spotlight: null };
  }
  if (Array.isArray(raw)) {
    const boards: Record<string, Board> = {};
    for (const b of raw as Board[]) {
      if (b?.game?.code) boards[b.game.code] = b;
    }
    return { __meta: true, boards, frozenCategories: {}, spotlight: null };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.__meta === true) {
    return {
      __meta: true,
      boards: (obj.boards && typeof obj.boards === 'object' ? (obj.boards as Record<string, Board>) : {}) ?? {},
      frozenCategories:
        (obj.frozenCategories && typeof obj.frozenCategories === 'object'
          ? (obj.frozenCategories as Record<string, FrozenCategoryMeta>)
          : {}) ?? {},
      spotlight: (obj.spotlight as ScreenSpotlight | null) ?? null,
    };
  }
  // Formato legado: Record<gameCode, Board>
  return {
    __meta: true,
    boards: obj as unknown as Record<string, Board>,
    frozenCategories: {},
    spotlight: null,
  };
}

export function summarizeFrozenCategories(
  map?: Record<string, FrozenCategoryMeta> | null,
): FrozenCategorySummary[] {
  if (!map) return [];
  return Object.values(map).map(({ gameCode, categoryId, categoryName, overlayText, frozenAt }) => ({
    gameCode,
    categoryId,
    categoryName,
    overlayText,
    frozenAt,
  }));
}

export type ScreenRecord = {
  id: string;
  name: string;
  mode: ScreenMode;
  rotateSeconds: number;
  frozen: boolean;
  frozenAt: Date | null;
  overlayText: string | null;
  frozenBoards: Board[] | null;
  frozenCategoriesMap?: Record<string, FrozenCategoryMeta> | null;
  spotlight?: ScreenSpotlight | null;
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
    frozenCategories?: FrozenCategorySummary[];
    spotlight?: ScreenSpotlight | null;
  };
  boards: Board[];
};

// Puro. Telão congelado usa SOMENTE a cópia gravada: os placares ao vivo são ignorados.
// Se apenas categorias específicas estiverem congeladas (frozen = false, frozenCategoriesMap preenchido),
// mantém os placares ao vivo nas demais categorias e aplica o snapshot congelado nas categorias bloqueadas.
export function buildScreenMessage(screen: ScreenRecord, liveBoards: Board[]): ScreenMessage {
  const source = screen.frozen ? (screen.frozenBoards ?? []) : liveBoards;
  const frozenMap = screen.frozenCategoriesMap ?? {};
  const frozenAtIso = screen.frozenAt ? screen.frozenAt.toISOString() : null;

  const processed = source.map((board) => {
    const gameCode = board.game.code;
    if (screen.frozen) {
      return {
        ...board,
        categories: board.categories.map((cat) => ({
          ...cat,
          frozen: true,
          frozenAt: cat.frozenAt ?? frozenAtIso,
          overlayText: cat.overlayText ?? screen.overlayText,
        })),
      };
    }

    const hasCatFreeze = board.categories.some((cat) => Boolean(frozenMap[`${gameCode}:${cat.id}`]));
    if (!hasCatFreeze) return board;

    return {
      ...board,
      categories: board.categories.map((cat) => {
        const meta = frozenMap[`${gameCode}:${cat.id}`];
        if (!meta) return cat;
        const base = meta.snapshot ?? cat;
        return {
          ...base,
          id: cat.id,
          name: cat.name,
          frozen: true,
          frozenAt: meta.frozenAt,
          overlayText: meta.overlayText,
        };
      }),
    };
  });

  // Ordem determinística por código (o jsonb reordena chaves e o banco não garante ordem)
  const boards = [...processed].sort((a, b) => (a.game.code < b.game.code ? -1 : a.game.code > b.game.code ? 1 : 0));
  const frozenCategories = summarizeFrozenCategories(frozenMap);

  return {
    type: 'screen',
    screen: {
      id: screen.id,
      name: screen.name,
      mode: screen.mode,
      rotateSeconds: screen.rotateSeconds,
      frozen: screen.frozen,
      frozenAt: frozenAtIso,
      overlayText: screen.overlayText,
      games: boards.map((b) => ({ code: b.game.code, name: b.game.name })),
      ...(frozenCategories.length > 0 ? { frozenCategories } : { frozenCategories: [] }),
      spotlight: screen.spotlight ?? null,
    },
    boards,
  };
}
