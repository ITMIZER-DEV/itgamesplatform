export interface RegistrationLockConfig {
  registrationLocked?: boolean | null;
  registrationStartAt?: string | null;
  registrationCloseAt?: string | null;
}

export interface RegistrationAvailability {
  isOpen: boolean;
  statusType: 'open' | 'locked_flag' | 'not_started' | 'expired_date' | 'game_not_live';
  badgeText: string;
  reason: string;
  startAtFormatted?: string;
  closeAtFormatted?: string;
  effectiveLocked: boolean;
  effectiveStartAt: string | null;
  effectiveCloseAt: string | null;
}

const LOCK_STORAGE_PREFIX = 'itgames_reg_lock_';

export function getLocalRegistrationLock(code?: string | null): RegistrationLockConfig | null {
  if (typeof window === 'undefined' || !code) return null;
  try {
    const raw = localStorage.getItem(`${LOCK_STORAGE_PREFIX}${code}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalRegistrationLock(code: string, patch: RegistrationLockConfig): void {
  if (typeof window === 'undefined' || !code) return;
  try {
    const prev = getLocalRegistrationLock(code) || {};
    const merged: RegistrationLockConfig = {
      ...prev,
      ...patch,
    };
    localStorage.setItem(`${LOCK_STORAGE_PREFIX}${code}`, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('itgames_reg_lock_changed', { detail: { code, ...merged } }));
  } catch {
    // ignore storage errors
  }
}

export function formatPtBrDateTime(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toDatetimeLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalInput(val?: string): string | null {
  if (!val || !val.trim()) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function evaluateRegistrationAvailability(
  game?: {
    code?: string;
    id?: string;
    status?: string | null;
    registrationLocked?: boolean | null;
    registrationStartAt?: string | null;
    registrationCloseAt?: string | null;
  } | null,
): RegistrationAvailability {
  if (!game) {
    return {
      isOpen: false,
      statusType: 'game_not_live',
      badgeText: 'Indisponível',
      reason: 'Nenhum campeonato selecionado.',
      effectiveLocked: false,
      effectiveStartAt: null,
      effectiveCloseAt: null,
    };
  }

  const gCode = game.code || game.id || '';
  const local = getLocalRegistrationLock(gCode);

  const effectiveLocked =
    game.registrationLocked !== undefined && game.registrationLocked !== null
      ? Boolean(game.registrationLocked)
      : Boolean(local?.registrationLocked);

  const effectiveStartAt =
    game.registrationStartAt !== undefined ? game.registrationStartAt : (local?.registrationStartAt ?? null);
  const effectiveCloseAt =
    game.registrationCloseAt !== undefined ? game.registrationCloseAt : (local?.registrationCloseAt ?? null);

  const startAtFormatted = formatPtBrDateTime(effectiveStartAt);
  const closeAtFormatted = formatPtBrDateTime(effectiveCloseAt);

  if (game.status && game.status !== 'live') {
    return {
      isOpen: false,
      statusType: 'game_not_live',
      badgeText: game.status === 'blocked' ? 'Evento Bloqueado' : 'Aguardando Liberação',
      reason: 'As inscrições ficam disponíveis apenas quando o campeonato está liberado (LIVE).',
      startAtFormatted,
      closeAtFormatted,
      effectiveLocked,
      effectiveStartAt,
      effectiveCloseAt,
    };
  }

  if (effectiveLocked) {
    return {
      isOpen: false,
      statusType: 'locked_flag',
      badgeText: 'Inscrições Bloqueadas (Flag)',
      reason: 'As inscrições foram bloqueadas manualmente pela organização do campeonato.',
      startAtFormatted,
      closeAtFormatted,
      effectiveLocked,
      effectiveStartAt,
      effectiveCloseAt,
    };
  }

  const now = Date.now();
  if (effectiveStartAt) {
    const startMs = new Date(effectiveStartAt).getTime();
    if (!Number.isNaN(startMs) && now < startMs) {
      return {
        isOpen: false,
        statusType: 'not_started',
        badgeText: `Abre em ${startAtFormatted}`,
        reason: `As inscrições abrirão em ${startAtFormatted}.`,
        startAtFormatted,
        closeAtFormatted,
        effectiveLocked,
        effectiveStartAt,
        effectiveCloseAt,
      };
    }
  }

  if (effectiveCloseAt) {
    const closeMs = new Date(effectiveCloseAt).getTime();
    if (!Number.isNaN(closeMs) && now > closeMs) {
      return {
        isOpen: false,
        statusType: 'expired_date',
        badgeText: 'Prazo Encerrado',
        reason: `O prazo de inscrições encerrou em ${closeAtFormatted}.`,
        startAtFormatted,
        closeAtFormatted,
        effectiveLocked,
        effectiveStartAt,
        effectiveCloseAt,
      };
    }
  }

  return {
    isOpen: true,
    statusType: 'open',
    badgeText: closeAtFormatted ? `Abertas até ${closeAtFormatted}` : 'Inscrições Abertas',
    reason: 'Inscrições abertas para este campeonato.',
    startAtFormatted,
    closeAtFormatted,
    effectiveLocked,
    effectiveStartAt,
    effectiveCloseAt,
  };
}
