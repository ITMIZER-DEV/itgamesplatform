'use client';

import { useEffect, useState } from 'react';
import { apiClient } from './api-client';
import { storage } from './storage';
import { buildLeaderboardView, LeaderboardApiResponse, LeaderboardView } from './leaderboard-data';

export type LeaderboardStatus = 'loading' | 'ok' | 'no-games' | 'error';

interface State {
  status: LeaderboardStatus;
  view: LeaderboardView | null;
}

// Escolhe o campeonato: ?game=CODIGO na URL, depois o último campeonato aberto, depois o primeiro liberado.
async function fetchLeaderboard(): Promise<State> {
  const games = await apiClient.listGames();
  if (!games) return { status: 'error', view: null };
  if (games.length === 0) return { status: 'no-games', view: null };

  const fromUrl = new URLSearchParams(window.location.search).get('game');
  const wanted = fromUrl || storage.getActiveGameId();
  const code = (games.find((g) => g.code === wanted) || games[0]).code as string;

  const raw = (await apiClient.getLeaderboard(code)) as LeaderboardApiResponse | null;
  if (!raw) return { status: 'error', view: null };
  return { status: 'ok', view: buildLeaderboardView(raw) };
}

// Dados reais do leaderboard, atualizados a cada pollMs milissegundos.
export function useLeaderboard(pollMs: number): State {
  const [state, setState] = useState<State>({ status: 'loading', view: null });

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetchLeaderboard()
        .then((next) => {
          if (!cancelled) setState(next);
        })
        .catch(() => {
          if (!cancelled) setState((prev) => (prev.view ? prev : { status: 'error', view: null }));
        });

    refresh();
    const timer = setInterval(refresh, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollMs]);

  return state;
}
