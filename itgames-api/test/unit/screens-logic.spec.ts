import {
  PAIRING_ALPHABET,
  OVERLAY_DEFAULT,
  OVERLAY_PRESETS,
  generatePairingCode,
  normalizePairingCode,
  isPairingExpired,
  clampRotateSeconds,
  parseOverlayText,
  parseScreenMode,
  validateScreenGames,
  effectiveGameCodes,
  canControlScreen,
  GameForScreen,
} from '../../src/modules/screens/screens-logic';
import { generateDeviceToken, hashDeviceToken } from '../../src/modules/screens/screen-token';
import { AttemptLimiter } from '../../src/modules/screens/attempt-limiter';
import { effectiveCodesForOwner } from '../../src/modules/screens/owner-codes';
import { randomInt } from 'crypto';

describe('código de pareamento', () => {
  it('gera 6 caracteres sem 0, O, 1, I (500 vezes)', () => {
    for (let i = 0; i < 500; i++) {
      const c = generatePairingCode((max) => randomInt(max));
      expect(c).toHaveLength(6);
      expect(c).toMatch(/^[^01OI]{6}$/);
      for (const ch of c) expect(PAIRING_ALPHABET).toContain(ch);
    }
  });

  it('normaliza e valida', () => {
    expect(normalizePairingCode(' k7f-29q ')).toBe('K7F29Q');
    expect(normalizePairingCode('K7F29')).toBeNull();
    expect(normalizePairingCode('K7F29O')).toBeNull();
    expect(normalizePairingCode(123)).toBeNull();
  });

  it('expira aos 10 minutos', () => {
    const exp = new Date('2026-01-01T00:10:00Z');
    expect(isPairingExpired(exp, new Date('2026-01-01T00:09:59Z'))).toBe(false);
    expect(isPairingExpired(exp, new Date('2026-01-01T00:10:00Z'))).toBe(true);
  });
});

describe('opções do telão', () => {
  it('clampRotateSeconds', () => {
    expect(clampRotateSeconds(undefined)).toBe(15);
    expect(clampRotateSeconds(1)).toBe(5);
    expect(clampRotateSeconds(500)).toBe(120);
    expect(clampRotateSeconds(30.4)).toBe(30);
    expect(clampRotateSeconds('abc')).toBe(15);
  });

  it('parseOverlayText', () => {
    expect(parseOverlayText(undefined)).toBe(OVERLAY_DEFAULT);
    expect(OVERLAY_DEFAULT).toBe('LEADERBOARD CONGELADO');
    expect(parseOverlayText('  Em revisão  ')).toBe('Em revisão');
    expect(parseOverlayText('a'.repeat(61))).toBeNull();
    expect(parseOverlayText('a'.repeat(60))).toBe('a'.repeat(60));
    expect(parseOverlayText('   ')).toBe(OVERLAY_DEFAULT);
  });

  it('OVERLAY_PRESETS tem só os dois modelos', () => {
    expect(OVERLAY_PRESETS).toEqual(['LEADERBOARD CONGELADO', 'LEADERBOARD EM REVISÃO']);
  });

  it('parseScreenMode', () => {
    expect(parseScreenMode('partial')).toBe('partial');
    expect(parseScreenMode('official')).toBe('official');
    expect(parseScreenMode('x')).toBeNull();
  });
});

describe('campeonatos do telão', () => {
  const known = new Map<string, GameForScreen>([
    ['A', { code: 'A', status: 'published', canManage: true }],
    ['B', { code: 'B', status: 'published', canManage: false }],
    ['C', { code: 'C', status: 'blocked', canManage: true }],
    ['D', { code: 'D', status: 'draft', canManage: true }],
  ]);

  it('validateScreenGames', () => {
    expect(validateScreenGames([], known, false)).toEqual(expect.any(String));
    expect(validateScreenGames(['Z'], known, false)).toEqual(expect.any(String));
    expect(validateScreenGames(['C'], known, false)).toEqual(expect.any(String));
    expect(validateScreenGames(['B'], known, false)).toEqual(expect.any(String));
    expect(validateScreenGames(['B'], known, true)).toBeNull();
    expect(validateScreenGames(['D'], known, false)).toBeNull();
    expect(validateScreenGames(['A', 'D'], known, false)).toBeNull();
  });

  it('effectiveGameCodes', () => {
    expect(effectiveGameCodes(['A', 'B'], new Set(['A']), new Set())).toEqual(['A']);
    expect(effectiveGameCodes(['A', 'B'], 'all', new Set())).toEqual(['A', 'B']);
    expect(effectiveGameCodes(['A', 'B'], 'all', new Set(['B']))).toEqual(['A']);
  });

  it('canControlScreen', () => {
    expect(canControlScreen({ id: 'u1', role: 'ORGANIZER' }, { ownerId: 'u1' })).toBe(true);
    expect(canControlScreen({ id: 'u2', role: 'ORGANIZER' }, { ownerId: 'u1' })).toBe(false);
    expect(canControlScreen({ id: 'u2', role: 'SUPER_ADMIN' }, { ownerId: 'u1' })).toBe(true);
    expect(canControlScreen({ id: 'u1', role: 'ORGANIZER' }, { ownerId: null })).toBe(false);
    expect(canControlScreen({ id: 'u2', role: 'SUPER_ADMIN' }, { ownerId: null })).toBe(true);
  });
});

describe('credencial do dispositivo', () => {
  it('gera tokens distintos e hash estável', () => {
    expect(generateDeviceToken()).not.toBe(generateDeviceToken());
    const h = hashDeviceToken('abc');
    expect(h).toBe(hashDeviceToken('abc'));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('AttemptLimiter', () => {
  it('janela deslizante com chaves independentes', () => {
    const l = new AttemptLimiter(3, 1000);
    expect([0, 100, 200].map((t) => l.hit('a', t))).toEqual([true, true, true]);
    expect(l.hit('a', 300)).toBe(false);
    expect(l.hit('b', 300)).toBe(true);
    expect(l.hit('a', 1001)).toBe(true);
  });

  it('release devolve a cota de uma tentativa consumida', () => {
    const l = new AttemptLimiter(2, 1000);
    expect(l.hit('a', 0)).toBe(true);
    expect(l.hit('a', 10)).toBe(true);
    expect(l.hit('a', 20)).toBe(false);
    l.release('a', 10);
    expect(l.hit('a', 30)).toBe(true);
    expect(l.hit('a', 40)).toBe(false);
    l.release('a', 999); // timestamp inexistente: nada acontece
    l.release('zzz', 0);
  });

  it('apaga a chave quando a janela esvazia', () => {
    const l = new AttemptLimiter(2, 1000);
    l.hit('a', 0);
    l.hit('b', 0);
    expect(l.size).toBe(2);
    l.release('a', 0);
    expect(l.size).toBe(1);
    expect(l.hit('b', 5000)).toBe(true); // 'b' antigo expirou; a nova tentativa fica
    expect(l.size).toBe(1);
  });
});

describe('effectiveCodesForOwner', () => {
  const fakeDb = (role: string | null, links: string[], games: { code: string; status: string }[]) =>
    ({
      user: { findUnique: async () => (role ? { role } : null) },
      game: { findMany: async () => games },
      gameOrganizer: { findMany: async () => links.map((gameCode) => ({ gameCode })) },
    }) as never;
  const games = [
    { code: 'A', status: 'live' },
    { code: 'B', status: 'blocked' },
    { code: 'C', status: 'live' },
  ];

  it('organizador dono: só vínculos ativos e não bloqueados', async () => {
    const r = await effectiveCodesForOwner(fakeDb('ORGANIZER', ['A', 'B'], games), 'o1', ['A', 'B', 'C']);
    expect(r).toEqual(['A']);
  });

  it('super admin dono: tudo que existe, exceto bloqueado', async () => {
    const r = await effectiveCodesForOwner(fakeDb('SUPER_ADMIN', [], games), 'o1', ['A', 'B', 'C', 'X']);
    expect(r).toEqual(['A', 'C']);
  });

  it('sem dono, dono inexistente ou outro papel: vazio', async () => {
    expect(await effectiveCodesForOwner(fakeDb('ORGANIZER', ['A'], games), null, ['A'])).toEqual([]);
    expect(await effectiveCodesForOwner(fakeDb(null, [], games), 'o1', ['A'])).toEqual([]);
    expect(await effectiveCodesForOwner(fakeDb('ATHLETE', [], games), 'o1', ['A'])).toEqual([]);
  });
});
