import { describe, expect, it } from 'vitest';
import { MOCK_GAME_IDS, purgeMockData } from '../mock-purge';

function fakeStore(initial: Record<string, unknown> = {}) {
  const map = new Map<string, string>(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    read: (k: string) => (map.has(k) ? JSON.parse(map.get(k) as string) : undefined),
  };
}

const MOCK = 'game_cf_2026';
const REAL = 'SUMMER2026';

describe('purgeMockData', () => {
  it('remove os campeonatos fictícios e tudo que aponta para eles, e mantém os reais', () => {
    const store = fakeStore({
      itgames_data_games: [{ id: MOCK }, { id: 'game_hy_2026' }, { id: REAL }],
      itgames_data_categories: [{ id: 'c1', gameId: MOCK }, { id: '1', gameId: REAL }],
      itgames_data_workouts: [{ id: 'w1', gameId: MOCK }, { id: '2', gameId: REAL }],
      itgames_data_teams: [{ id: 't1', gameId: MOCK }, { id: '1101', gameId: REAL }],
      itgames_data_scores: [{ id: 's1', gameId: MOCK }],
      itgames_data_heats: [{ id: 'h1', gameId: MOCK }, { id: 'h2', gameId: REAL }],
      itgames_data_audit_logs: [{ id: 'a1', gameId: MOCK }, { id: 'a2', gameId: REAL }],
    });

    expect(purgeMockData(store)).toBe(true);

    expect(store.read('itgames_data_games')).toEqual([{ id: REAL }]);
    expect(store.read('itgames_data_categories')).toEqual([{ id: '1', gameId: REAL }]);
    expect(store.read('itgames_data_workouts')).toEqual([{ id: '2', gameId: REAL }]);
    expect(store.read('itgames_data_teams')).toEqual([{ id: '1101', gameId: REAL }]);
    expect(store.read('itgames_data_scores')).toEqual([]);
    expect(store.read('itgames_data_heats')).toEqual([{ id: 'h2', gameId: REAL }]);
    expect(store.read('itgames_data_audit_logs')).toEqual([{ id: 'a2', gameId: REAL }]);
  });

  it('limpa a preferência de campeonato ativo que aponta para um fictício, mas mantém a de um real', () => {
    const fake = fakeStore({ itgames_active_game_id: MOCK });
    purgeMockData(fake);
    expect(fake.getItem('itgames_active_game_id')).toBeNull();

    const real = fakeStore({ itgames_active_game_id: REAL });
    purgeMockData(real);
    expect(real.read('itgames_active_game_id')).toBe(REAL);
  });

  it('só roda uma vez: a segunda chamada não altera nada, mesmo que apareçam fictícios depois', () => {
    const store = fakeStore({ itgames_data_games: [{ id: MOCK }] });
    expect(purgeMockData(store)).toBe(true);
    store.setItem('itgames_data_games', JSON.stringify([{ id: MOCK }]));
    expect(purgeMockData(store)).toBe(false);
    expect(store.read('itgames_data_games')).toEqual([{ id: MOCK }]);
  });

  it('não quebra com armazenamento vazio ou JSON inválido', () => {
    const store = fakeStore();
    store.setItem('itgames_data_games', '{quebrado');
    expect(() => purgeMockData(store)).not.toThrow();
    expect(MOCK_GAME_IDS).toEqual(['game_cf_2026', 'game_hy_2026']);
  });
});
