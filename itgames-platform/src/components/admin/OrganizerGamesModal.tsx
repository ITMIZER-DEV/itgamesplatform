'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';

interface GameRow {
  code: string;
  name: string;
  status?: string;
  organizers?: { id: string }[];
}

interface Props {
  organizer: { id: string; name: string };
  onClose: () => void;
  onChanged: () => void;
}

export function OrganizerGamesModal({ organizer, onClose, onChanged }: Props) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const reload = () => apiClient.listMyGames().then((list) => setGames(list as GameRow[]));

  useEffect(() => {
    reload()
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar campeonatos'))
      .finally(() => setIsLoading(false));
  }, []);

  const isLinked = (g: GameRow) => (g.organizers || []).some((o) => o.id === organizer.id);

  const toggle = async (g: GameRow) => {
    setBusyCode(g.code);
    try {
      if (isLinked(g)) {
        await apiClient.removeGameOrganizer(g.code, organizer.id);
      } else {
        await apiClient.addGameOrganizer(g.code, organizer.id);
      }
      await reload();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao atualizar o vínculo');
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-3xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white">Campeonatos de {organizer.name}</h3>
            <p className="text-xs text-zinc-400">Marque os campeonatos que este organizador pode gerenciar.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {isLoading && <li className="text-xs text-zinc-500">Carregando...</li>}
          {!isLoading && games.length === 0 && <li className="text-xs text-zinc-500">Nenhum campeonato cadastrado.</li>}
          {games.map((g) => (
            <li key={g.code}>
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLinked(g)}
                  disabled={busyCode === g.code}
                  onChange={() => toggle(g)}
                  className="w-4 h-4 accent-amber-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">{g.name}</div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    {g.code} • {g.status === 'live' ? 'Liberado' : g.status === 'draft' ? 'Rascunho' : 'Bloqueado'}
                  </div>
                </div>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
