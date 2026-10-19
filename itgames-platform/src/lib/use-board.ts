'use client';

import { useEffect, useState } from 'react';
import { apiClient } from './api-client';
import { storage } from './storage';
import { chooseBoardGameCode, type BoardResponse } from './board';

export type BoardStatus = 'loading' | 'ok' | 'no-games' | 'error';

interface State {
  status: BoardStatus;
  board: BoardResponse | null;
}

// Escolhe o campeonato: o código pedido pela página; sem ele, ?game=CODIGO na URL, depois o último aberto, depois o primeiro liberado.
async function fetchBoard(requested?: string | null): Promise<State> {
  const games = await apiClient.listGames();
  if (!games) return { status: 'error', board: null };
  if (games.length === 0) return { status: 'no-games', board: null };

  const code = chooseBoardGameCode(games as { code: string }[], {
    requested,
    fromUrl: new URLSearchParams(window.location.search).get('game'),
    stored: storage.getActiveGameId(),
  });

  const board = await apiClient.getBoard(code);
  if (!board) return { status: 'error', board: null };
  return { status: 'ok', board };
}

// Placar calculado pelo servidor, atualizado a cada pollMs milissegundos.
export function useBoard(pollMs: number, code?: string | null): State {
  const [state, setState] = useState<State>({ status: 'loading', board: null });

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetchBoard(code)
        .then((next) => {
          if (!cancelled) setState(next);
        })
        .catch(() => {
          if (!cancelled) setState((prev) => (prev.board ? prev : { status: 'error', board: null }));
        });

    refresh();
    const timer = setInterval(refresh, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollMs, code]);

  return state;
}
