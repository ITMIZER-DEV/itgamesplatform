'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { FrozenCategorySummary } from '@/lib/screens';

export interface FreezeView {
  /** true quando o servidor respondeu ao menos uma vez (até lá, use o estado local). */
  loaded: boolean;
  frozen: boolean;
  categories: Record<string, FrozenCategorySummary>;
}

const EMPTY: FreezeView = { loaded: false, frozen: false, categories: {} };

/**
 * Congelamento do placar lido do servidor, igual em todos os aparelhos (placar público, atletas, telão).
 * Atualiza a cada `intervalMs` e na hora quando a Mesa do Head Judge muda algo neste navegador.
 */
export function useServerFreeze(gameCode: string | undefined, intervalMs = 10_000): FreezeView {
  const [view, setView] = useState<FreezeView>(EMPTY);
  // numera as leituras: uma resposta que chega depois de outra mais nova é descartada
  // (senão a leitura periódica anterior ao clique desfaz o congelamento na tela)
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (!gameCode) return;
    const mine = ++seq.current;
    const state = await apiClient.getFreezeState(gameCode);
    if (mine !== seq.current) return;
    if (!state) return; // sem resposta: mantém o último estado conhecido
    const categories: Record<string, FrozenCategorySummary> = {};
    for (const c of state.categories) {
      categories[String(c.categoryId)] = { gameCode, ...c };
    }
    setView({ loaded: true, frozen: state.frozen, categories });
  }, [gameCode]);

  useEffect(() => {
    setView(EMPTY);
    if (!gameCode) return;
    refresh();
    const timer = setInterval(refresh, intervalMs);
    const onLocalChange = () => {
      refresh();
    };
    window.addEventListener('itgames_freeze_changed', onLocalChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener('itgames_freeze_changed', onLocalChange);
    };
  }, [gameCode, intervalMs, refresh]);

  return view;
}
