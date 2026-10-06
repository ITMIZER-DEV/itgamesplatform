'use client';

import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, OrganizerUser } from '@/lib/api-client';

interface Props {
  game: { code: string; name: string };
  onClose: () => void;
  onChanged: () => void;
}

export function GameOrganizersModal({ game, onClose, onChanged }: Props) {
  const [linked, setLinked] = useState<OrganizerUser[]>([]);
  const [all, setAll] = useState<OrganizerUser[]>([]);
  const [selected, setSelected] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiClient.getGame(game.code), apiClient.listOrganizers()])
      .then(([detail, organizers]) => {
        setLinked(detail?.organizers || []);
        setAll(organizers);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar organizadores'))
      .finally(() => setIsLoading(false));
  }, [game.code]);

  const available = all.filter((o) => !linked.some((l) => l.id === o.id));

  const handleAdd = async () => {
    if (!selected) return;
    try {
      setLinked(await apiClient.addGameOrganizer(game.code, selected));
      setSelected('');
      onChanged();
      toast.success('Organizador vinculado ao campeonato');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao vincular organizador');
    }
  };

  const handleToggleActive = async (o: OrganizerUser) => {
    const next = o.active === false; // suspenso → reativa; ativo → suspende
    try {
      setLinked(await apiClient.setGameOrganizerActive(game.code, o.id, next));
      onChanged();
      toast.success(next ? 'Organizador reativado neste campeonato' : 'Organizador suspenso neste campeonato');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao alterar o organizador');
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setLinked(await apiClient.removeGameOrganizer(game.code, userId));
      onChanged();
      toast.success('Organizador desvinculado');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao desvincular organizador');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-3xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white">Organizadores do campeonato</h3>
            <p className="text-xs text-zinc-400">
              {game.name} ({game.code})
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="space-y-2">
          {isLoading && <li className="text-xs text-zinc-500">Carregando...</li>}
          {!isLoading && linked.length === 0 && (
            <li className="text-xs text-zinc-500">Nenhum organizador vinculado. Só o super admin gerencia este campeonato.</li>
          )}
          {linked.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
              <div className={o.active === false ? 'opacity-60' : ''}>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  {o.name}
                  {o.active === false && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Suspenso
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">{o.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(o)}
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold"
                  title={o.active === false ? 'Reativar neste campeonato' : 'Suspender neste campeonato (mantém o vínculo)'}
                >
                  {o.active === false ? 'Reativar' : 'Suspender'}
                </button>
                <button
                  onClick={() => handleRemove(o.id)}
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                  title="Desvincular"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
          >
            <option value="">Selecione um organizador...</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} — {o.email}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selected}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            <span>Vincular</span>
          </button>
        </div>
      </div>
    </div>
  );
}
