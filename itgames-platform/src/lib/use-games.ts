'use client';

import { useEffect, useState } from 'react';
import { GameEvent } from '@/types';
import { apiClient } from './api-client';
import { getCurrentUserSession, UserRoleType } from './acl';
import { mapGame, pickActiveGame } from './arena-data';
import { purgeMockData } from './mock-purge';
import { storage } from './storage';

// Campeonatos reais para o seletor: super admin e organizador veem os seus (qualquer status);
// os demais perfis veem os liberados. Nenhum dado local ou fictício entra aqui.
export function useGames() {
  const [games, setGames] = useState<GameEvent[]>([]);
  // preferência salva (só o código); lida de forma lazy para não setar estado dentro de efeito
  const [activeCode, setActiveCode] = useState<string>(() =>
    typeof window === 'undefined' ? '' : storage.getActiveGameId(),
  );
  const [role, setRole] = useState<UserRoleType>('GUEST');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // remove os fictícios antigos antes de qualquer leitura (idempotente)
    purgeMockData(window.localStorage);

    let cancelled = false;
    const currentRole = getCurrentUserSession().role;
    const request: Promise<any[] | null> =
      currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER'
        ? apiClient.listMyGames()
        : apiClient.listGames();

    request
      .then((list) => {
        if (cancelled) return;
        setRole(currentRole);
        if (!list) {
          setError('Não foi possível carregar os campeonatos.');
          setGames([]);
          return;
        }
        setError(null);
        setGames(list.map(mapGame));
      })
      .catch(() => {
        if (cancelled) return;
        setRole(currentRole);
        setError('Não foi possível carregar os campeonatos.');
        setGames([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    const onAuthChanged = () => setReloadKey((k) => k + 1);
    // outra tela trocou o campeonato ativo
    const onStorageUpdated = () => setActiveCode(storage.getActiveGameId());
    window.addEventListener('itgames_auth_changed', onAuthChanged);
    window.addEventListener('itgames_storage_updated', onStorageUpdated);
    return () => {
      window.removeEventListener('itgames_auth_changed', onAuthChanged);
      window.removeEventListener('itgames_storage_updated', onStorageUpdated);
    };
  }, []);

  const activeGame = pickActiveGame(games, activeCode);

  const setActiveGame = (code: string) => {
    setActiveCode(code);
    storage.setActiveGameId(code); // também avisa as outras telas
  };

  return {
    games,
    activeGame,
    isLoading,
    error,
    role,
    setActiveGame,
    reload: () => setReloadKey((k) => k + 1),
  };
}
