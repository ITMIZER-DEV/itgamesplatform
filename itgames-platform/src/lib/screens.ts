// Utilitários dos telões de TV (espelha o contrato da API em itgames-api/src/modules/screens).

export type ScreenMode = 'partial' | 'official';

export interface FrozenCategorySummary {
  gameCode: string;
  categoryId: number;
  categoryName: string;
  overlayText: string;
  frozenAt: string;
}

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

export interface ScreenView {
  id: string;
  name: string;
  mode: ScreenMode;
  rotateSeconds: number;
  frozen: boolean;
  frozenAt: string | null;
  overlayText: string | null;
  gameCodes: string[];
  online: boolean;
  lastSeenAt: string | null;
  ownerId: string | null;
  frozenCategories?: FrozenCategorySummary[];
  spotlight?: ScreenSpotlight | null;
}

export const OVERLAY_PRESETS: string[] = [
  'LEADERBOARD CONGELADO',
  'LEADERBOARD EM REVISÃO',
  'CATEGORIA EM REVISÃO',
  'LEADERBOARD BLOQUEADO',
  'AGUARDE APURAÇÃO OFICIAL',
];

export const OVERLAY_MAX_LENGTH = 60;
export const ROTATE_MIN = 5;
export const ROTATE_MAX = 120;
export const ROTATE_DEFAULT = 15;

/** Normaliza o código digitado: maiúsculas, sem espaço/hífen, no máximo 6 caracteres. */
export function normalizeCodeInput(text: string): string {
  return text.toUpperCase().replace(/[\s-]/g, '').slice(0, 6);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Texto relativo de "última vez visto" (ex.: "visto há 7 min"). */
export function formatLastSeen(lastSeenAt: string | null, now: Date): string {
  if (!lastSeenAt) return 'nunca visto';
  const diffMs = now.getTime() - new Date(lastSeenAt).getTime();
  const minutes = Math.floor(Math.max(0, diffMs) / 60_000);
  if (minutes < 1) return 'visto agora há pouco';
  if (minutes < 60) return `visto há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `visto há ${hours} h`;
  return `visto há ${Math.floor(hours / 24)} d`;
}

/** Estado exibido na lista: ao vivo, congelado (com hora) ou offline. */
export function describeScreenState(
  s: ScreenView,
  now: Date,
): { label: string; tone: 'live' | 'frozen' | 'offline' } {
  if (s.frozen) {
    const at = s.frozenAt ? new Date(s.frozenAt) : null;
    const hora = at ? `${pad2(at.getHours())}:${pad2(at.getMinutes())}` : '--:--';
    return { label: `congelado desde ${hora}`, tone: 'frozen' };
  }
  if (s.frozenCategories && s.frozenCategories.length > 0) {
    const count = s.frozenCategories.length;
    const label =
      count === 1
        ? `${s.frozenCategories[0].categoryName} em revisão`
        : `${count} categorias em revisão`;
    return { label, tone: 'frozen' };
  }
  if (!s.online) {
    return { label: `offline — ${formatLastSeen(s.lastSeenAt, now)}`, tone: 'offline' };
  }
  return { label: 'ao vivo', tone: 'live' };
}

/** Texto do aviso de congelamento: 1 a 60 caracteres após aparar (mesma contagem do servidor). */
export function isValidOverlayText(text: string): boolean {
  const len = text.trim().length;
  return len >= 1 && len <= OVERLAY_MAX_LENGTH;
}

/**
 * Edição de telão: o formulário só mostra os campeonatos de /events/mine. Códigos do telão fora dessa
 * lista (vínculo suspenso, campeonato de outro organizador) não aparecem e nunca devem ser reenviados
 * (o servidor responderia 400). Devolve os códigos a enviar no PATCH, ou undefined quando a seleção
 * visível não mudou (então `gameCodes` é omitido).
 */
export function gameCodesForPatch(
  initial: string[],
  selected: string[],
  visibleCodes: string[],
): string[] | undefined {
  const visible = new Set(visibleCodes);
  const before = new Set(initial.filter((c) => visible.has(c)));
  const now = selected.filter((c) => visible.has(c));
  const same = now.length === before.size && now.every((c) => before.has(c));
  return same ? undefined : now;
}

// ─── Sincronização Local & BroadcastChannel (Categorias Congeladas e Spotlight) ───

const FROZEN_CATS_KEY_PREFIX = 'itgames_frozen_categories_';
const SPOTLIGHT_KEY = 'itgames_arena_spotlight';

export function getLocalFrozenCategories(gameCode: string): Record<string, FrozenCategorySummary> {
  if (typeof window === 'undefined' || !gameCode) return {};
  try {
    const raw = localStorage.getItem(`${FROZEN_CATS_KEY_PREFIX}${gameCode}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLocalFrozenCategories(
  gameCode: string,
  categoriesMap: Record<string, FrozenCategorySummary>,
): void {
  if (typeof window === 'undefined' || !gameCode) return;
  try {
    if (Object.keys(categoriesMap).length === 0) {
      localStorage.removeItem(`${FROZEN_CATS_KEY_PREFIX}${gameCode}`);
    } else {
      localStorage.setItem(`${FROZEN_CATS_KEY_PREFIX}${gameCode}`, JSON.stringify(categoriesMap));
    }
    window.dispatchEvent(
      new CustomEvent('itgames_freeze_changed', {
        detail: { gameCode, frozenCategories: categoriesMap },
      }),
    );
    const bc = new BroadcastChannel('itgames_freeze_channel');
    bc.postMessage({ gameCode, frozenCategories: categoriesMap, timestamp: Date.now() });
    bc.close();
  } catch {
    // ignore
  }
}

export function getLocalArenaSpotlight(): ScreenSpotlight | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SPOTLIGHT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScreenSpotlight;
  } catch {
    return null;
  }
}

export function saveLocalArenaSpotlight(spotlight: ScreenSpotlight | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!spotlight) {
      localStorage.removeItem(SPOTLIGHT_KEY);
    } else {
      localStorage.setItem(SPOTLIGHT_KEY, JSON.stringify(spotlight));
    }
    window.dispatchEvent(new CustomEvent('itgames_spotlight_changed', { detail: { spotlight } }));
    const bc = new BroadcastChannel('itgames_freeze_channel');
    bc.postMessage({ spotlight, spotlightUpdated: true, timestamp: Date.now() });
    bc.close();
  } catch {
    // ignore
  }
}
