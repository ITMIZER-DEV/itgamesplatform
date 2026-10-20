// Lógica pura dos telões (sem Nest/Prisma): aleatoriedade e relógio são injetados.

// Sem 0, O, 1 e I para evitar confusão ao digitar o código na TV.
export const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_TTL_MS = 600_000;
export const OVERLAY_DEFAULT = 'LEADERBOARD CONGELADO';
export const OVERLAY_PRESETS: readonly string[] = [OVERLAY_DEFAULT, 'LEADERBOARD EM REVISÃO'];

const OVERLAY_MAX = 60;
const ROTATE_DEFAULT = 15;
const ROTATE_MIN = 5;
const ROTATE_MAX = 120;

export type ScreenMode = 'partial' | 'official';

export function generatePairingCode(randomInt: (max: number) => number): string {
  let code = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  }
  return code;
}

// Maiúsculas, ignora espaço e hífen; devolve null se tamanho/alfabeto forem inválidos.
export function normalizePairingCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== PAIRING_CODE_LENGTH) return null;
  for (const ch of code) if (!PAIRING_ALPHABET.includes(ch)) return null;
  return code;
}

export function isPairingExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export function clampRotateSeconds(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) return ROTATE_DEFAULT;
  return Math.min(ROTATE_MAX, Math.max(ROTATE_MIN, Math.round(input)));
}

// undefined/vazio -> texto padrão; mais de 60 caracteres (após trim) -> null.
export function parseOverlayText(input: unknown): string | null {
  if (input === undefined || input === null) return OVERLAY_DEFAULT;
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text) return OVERLAY_DEFAULT;
  return text.length > OVERLAY_MAX ? null : text;
}

export function parseScreenMode(input: unknown): ScreenMode | null {
  return input === 'partial' || input === 'official' ? input : null;
}

export interface GameForScreen {
  code: string;
  status?: string | null;
  canManage: boolean;
}

// Devolve a mensagem de erro (português) ou null se a seleção é válida.
export function validateScreenGames(
  requested: string[],
  known: ReadonlyMap<string, GameForScreen>,
  isSuperAdmin: boolean,
): string | null {
  if (!requested.length) return 'Selecione ao menos um campeonato.';
  for (const code of requested) {
    const game = known.get(code);
    if (!game) return `Campeonato ${code} não encontrado.`;
    if (game.status === 'blocked') return `Campeonato ${code} está bloqueado.`;
    if (!isSuperAdmin && !game.canManage) return `Você não gerencia o campeonato ${code}.`;
  }
  return null;
}

// Campeonatos que o telão de fato exibe: gerenciáveis pelo dono e não bloqueados.
export function effectiveGameCodes(
  codes: string[],
  manageable: ReadonlySet<string> | 'all',
  blocked: ReadonlySet<string>,
): string[] {
  return codes.filter((c) => !blocked.has(c) && (manageable === 'all' || manageable.has(c)));
}

export function canControlScreen(
  user: { id: string; role: string },
  screen: { ownerId: string | null },
): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  return screen.ownerId !== null && screen.ownerId === user.id;
}
