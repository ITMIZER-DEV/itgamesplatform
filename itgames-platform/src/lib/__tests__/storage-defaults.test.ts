import { beforeEach, describe, expect, it } from 'vitest';

// localStorage mínimo em memória; "window" aponta para o próprio global para o storage se considerar no navegador
const data = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
  clear: () => data.clear(),
};
const dispatched: string[] = [];
Object.assign(globalThis, {
  window: globalThis,
  localStorage: fakeLocalStorage,
  dispatchEvent: (e: Event) => {
    dispatched.push(e.type);
    return true;
  },
});

describe('storage sem dados fictícios', () => {
  beforeEach(() => data.clear());

  it('initDefaultsIfEmpty não semeia campeonatos nem dados de arena', async () => {
    const { storage } = await import('../storage');
    storage.initDefaultsIfEmpty();
    expect(storage.getGames()).toEqual([]);
    expect(storage.getCategories()).toEqual([]);
    expect(storage.getWorkouts()).toEqual([]);
    expect(storage.getTeams()).toEqual([]);
    expect(storage.getScores()).toEqual([]);
    expect(storage.getHeats()).toEqual([]);
    expect(JSON.stringify([...data.values()])).not.toContain('game_cf_2026');
    expect(JSON.stringify([...data.values()])).not.toContain('game_hy_2026');
  });

  it('remove os fictícios que já estavam gravados e preserva os reais', async () => {
    data.set('itgames_data_games', JSON.stringify([{ id: 'game_cf_2026' }, { id: 'SUMMER2026' }]));
    const { storage } = await import('../storage');
    storage.initDefaultsIfEmpty();
    expect(storage.getGames().map((g) => g.id)).toEqual(['SUMMER2026']);
  });
});

describe('evento itgames_games_changed', () => {
  beforeEach(() => {
    data.clear();
    dispatched.length = 0;
  });

  it('saveGame e deleteGame disparam itgames_games_changed', async () => {
    const { storage } = await import('../storage');
    storage.saveGame({ id: 'ABC', name: 'X' } as any);
    expect(dispatched).toContain('itgames_games_changed');
    dispatched.length = 0;
    storage.deleteGame('ABC');
    expect(dispatched).toContain('itgames_games_changed');
  });

  it('ler ou trocar o campeonato ativo não dispara itgames_games_changed', async () => {
    const { storage } = await import('../storage');
    storage.getGames();
    storage.setActiveGameId('ABC');
    expect(dispatched).toContain('itgames_storage_updated');
    expect(dispatched).not.toContain('itgames_games_changed');
  });
});
