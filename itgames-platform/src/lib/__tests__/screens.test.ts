import { describe, it, expect } from 'vitest';
import {
  OVERLAY_PRESETS,
  ScreenView,
  describeScreenState,
  formatLastSeen,
  isValidOverlayText,
  normalizeCodeInput,
} from '../screens';

const NOW = new Date(2026, 9, 20, 15, 0, 0);

function screen(over: Partial<ScreenView> = {}): ScreenView {
  return {
    id: 's1',
    name: 'Telão principal',
    mode: 'partial',
    rotateSeconds: 15,
    frozen: false,
    frozenAt: null,
    overlayText: null,
    gameCodes: ['abc'],
    online: true,
    lastSeenAt: NOW.toISOString(),
    ownerId: 'u1',
    ...over,
  };
}

describe('normalizeCodeInput', () => {
  it('põe em maiúsculas, remove espaço/hífen e corta em 6', () => {
    expect(normalizeCodeInput(' k7f-29q9 ')).toBe('K7F29Q');
  });
  it('aceita texto vazio', () => {
    expect(normalizeCodeInput('')).toBe('');
  });
});

describe('describeScreenState', () => {
  it('ao vivo quando online e descongelado', () => {
    expect(describeScreenState(screen(), NOW)).toEqual({ label: 'ao vivo', tone: 'live' });
  });
  it('congelado mostra a hora formatada', () => {
    const frozenAt = new Date(2026, 9, 20, 14, 5, 0).toISOString();
    expect(describeScreenState(screen({ frozen: true, frozenAt }), NOW)).toEqual({
      label: 'congelado desde 14:05',
      tone: 'frozen',
    });
  });
  it('offline mostra há quantos minutos foi visto', () => {
    const lastSeenAt = new Date(NOW.getTime() - 7 * 60_000).toISOString();
    expect(describeScreenState(screen({ online: false, lastSeenAt }), NOW)).toEqual({
      label: 'offline — visto há 7 min',
      tone: 'offline',
    });
  });
  it('offline nunca visto', () => {
    const r = describeScreenState(screen({ online: false, lastSeenAt: null }), NOW);
    expect(r.tone).toBe('offline');
    expect(r.label).toBe('offline — nunca visto');
  });
});

describe('formatLastSeen', () => {
  it('nunca visto', () => {
    expect(formatLastSeen(null, NOW)).toBe('nunca visto');
  });
  it('menos de um minuto', () => {
    expect(formatLastSeen(new Date(NOW.getTime() - 20_000).toISOString(), NOW)).toBe('visto agora há pouco');
  });
  it('minutos e horas', () => {
    expect(formatLastSeen(new Date(NOW.getTime() - 5 * 60_000).toISOString(), NOW)).toBe('visto há 5 min');
    expect(formatLastSeen(new Date(NOW.getTime() - 3 * 3_600_000).toISOString(), NOW)).toBe('visto há 3 h');
  });
});

describe('isValidOverlayText', () => {
  it('rejeita vazio e só espaços', () => {
    expect(isValidOverlayText('')).toBe(false);
    expect(isValidOverlayText('   ')).toBe(false);
  });
  it('aceita texto normal e os modelos', () => {
    expect(isValidOverlayText('EM REVISÃO')).toBe(true);
    for (const p of OVERLAY_PRESETS) expect(isValidOverlayText(p)).toBe(true);
  });
  it('limite de 60 caracteres', () => {
    expect(isValidOverlayText('A'.repeat(60))).toBe(true);
    expect(isValidOverlayText('A'.repeat(61))).toBe(false);
  });
});

describe('OVERLAY_PRESETS', () => {
  it('traz os dois modelos', () => {
    expect(OVERLAY_PRESETS).toEqual(['LEADERBOARD CONGELADO', 'LEADERBOARD EM REVISÃO']);
  });
});
