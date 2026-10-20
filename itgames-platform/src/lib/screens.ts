// Utilitários dos telões de TV (espelha o contrato da API em itgames-api/src/modules/screens).

export type ScreenMode = 'partial' | 'official';

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
}

export const OVERLAY_PRESETS: string[] = ['LEADERBOARD CONGELADO', 'LEADERBOARD EM REVISÃO'];

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
