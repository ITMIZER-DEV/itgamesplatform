// Limpeza única dos campeonatos fictícios que versões antigas gravaram no navegador.
// Remove só o que pertence aos ids fictícios; dados de campeonatos reais não são tocados.

export const MOCK_GAME_IDS = ['game_cf_2026', 'game_hy_2026'];

const MARKER = 'itgames_mock_purged_v1';
const ACTIVE_GAME_KEY = 'itgames_active_game_id';

// chave do armazenamento → campo que identifica o campeonato em cada registro
const KEYS_BY_GAME_FIELD: Array<[string, string]> = [
  ['itgames_data_games', 'id'],
  ['itgames_data_categories', 'gameId'],
  ['itgames_data_workouts', 'gameId'],
  ['itgames_data_teams', 'gameId'],
  ['itgames_data_scores', 'gameId'],
  ['itgames_data_heats', 'gameId'],
  ['itgames_data_audit_logs', 'gameId'],
];

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isMockId(value: unknown): boolean {
  return typeof value === 'string' && MOCK_GAME_IDS.includes(value);
}

function readList(store: Store, key: string): any[] | null {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Devolve true quando limpou agora; false se já tinha rodado neste navegador.
export function purgeMockData(store: Store): boolean {
  if (store.getItem(MARKER)) return false;

  for (const [key, field] of KEYS_BY_GAME_FIELD) {
    const list = readList(store, key);
    if (!list) continue;
    const kept = list.filter((item) => !isMockId(item?.[field]));
    if (kept.length !== list.length) store.setItem(key, JSON.stringify(kept));
  }

  try {
    const raw = store.getItem(ACTIVE_GAME_KEY);
    if (raw && isMockId(JSON.parse(raw))) store.removeItem(ACTIVE_GAME_KEY);
  } catch {
    // preferência ilegível: ignora
  }

  store.setItem(MARKER, '1');
  return true;
}
