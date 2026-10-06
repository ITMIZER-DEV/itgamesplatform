'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Pencil, Trophy, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, OrganizerUser } from '@/lib/api-client';
import { OrganizerGamesModal } from './OrganizerGamesModal';

interface IssuedPassword {
  name: string;
  email: string;
  password: string;
}

export function OrganizersPanel() {
  const [organizers, setOrganizers] = useState<OrganizerUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [editing, setEditing] = useState<OrganizerUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [gamesFor, setGamesFor] = useState<OrganizerUser | null>(null);

  const load = useCallback(async () => {
    try {
      setOrganizers(await apiClient.listOrganizers());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar organizadores');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    apiClient
      .listOrganizers()
      .then(setOrganizers)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar organizadores'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await apiClient.createOrganizer({ name, email, phoneNumber: phone });
      setIssued({ name: res.user.name, email: res.user.email, password: res.temporaryPassword });
      setName('');
      setEmail('');
      setPhone('');
      toast.success('Organizador cadastrado!');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao cadastrar organizador');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async (org: OrganizerUser) => {
    if (!confirm(`Gerar nova senha temporária para ${org.name}? A senha atual deixará de funcionar.`)) return;
    try {
      const res = await apiClient.resetOrganizerPassword(org.id);
      setIssued({ name: res.user.name, email: res.user.email, password: res.temporaryPassword });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao redefinir a senha');
    }
  };

  const openEdit = (org: OrganizerUser) => {
    setEditing(org);
    setEditName(org.name);
    setEditEmail(org.email);
    setEditPhone(org.phoneNumber || '');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    try {
      await apiClient.updateOrganizer(editing.id, { name: editName, email: editEmail, phoneNumber: editPhone });
      toast.success('Organizador atualizado!');
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao atualizar organizador');
    } finally {
      setIsSaving(false);
    }
  };

  const copyPassword = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.password);
      toast.success('Senha copiada!');
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  const inputClass =
    'w-full bg-zinc-950 border border-zinc-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <label className="space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Nome</span>
          <input className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">E-mail</span>
          <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Telefone</span>
          <input className={inputClass} required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isSaving ? 'Cadastrando...' : 'Cadastrar organizador'}</span>
        </button>
      </form>

      {issued && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/40 space-y-3">
          <div className="text-sm font-black text-amber-300">Senha temporária de {issued.name}</div>
          <p className="text-xs text-zinc-300">
            Repasse ao organizador ({issued.email}). Ela só é exibida agora e precisará ser trocada no primeiro acesso.
          </p>
          <div className="flex items-center gap-2">
            <code className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-amber-300 font-mono text-base select-all">
              {issued.password}
            </code>
            <button
              onClick={copyPassword}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white flex items-center gap-1.5"
            >
              <Copy className="w-4 h-4" />
              <span>Copiar</span>
            </button>
            <button onClick={() => setIssued(null)} className="px-3 py-2 text-xs text-zinc-400 hover:text-white underline">
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-zinc-400 uppercase text-[10px] border-b border-zinc-800">
              <th className="py-3 px-4">Nome</th>
              <th className="py-3 px-4">E-mail</th>
              <th className="py-3 px-4">Telefone</th>
              <th className="py-3 px-4 text-center">Campeonatos</th>
              <th className="py-3 px-4 text-center">Acesso</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-500">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && organizers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-500">
                  Nenhum organizador cadastrado.
                </td>
              </tr>
            )}
            {organizers.map((o) => (
              <tr key={o.id} className="border-b border-zinc-800/60 text-zinc-200">
                <td className="py-3 px-4 font-bold">{o.name}</td>
                <td className="py-3 px-4 font-mono">{o.email}</td>
                <td className="py-3 px-4">{o.phoneNumber || '—'}</td>
                <td className="py-3 px-4 text-center">{o._count?.organizedGames ?? 0}</td>
                <td className="py-3 px-4 text-center">
                  {o.mustChangePassword ? (
                    <span className="text-amber-400 font-bold">Aguardando 1º acesso</span>
                  ) : (
                    <span className="text-emerald-400 font-bold">Ativo</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                  <button
                    onClick={() => openEdit(o)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold inline-flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => setGamesFor(o)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold inline-flex items-center gap-1.5"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Campeonatos</span>
                  </button>
                  <button
                    onClick={() => handleReset(o)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold inline-flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Nova senha</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleUpdate}
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-black text-white">Editar organizador</h3>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Nome</span>
              <input className={inputClass} required value={editName} onChange={(e) => setEditName(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">E-mail</span>
              <input
                className={inputClass}
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Telefone</span>
              <input className={inputClass} required value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-60"
              >
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {gamesFor && <OrganizerGamesModal organizer={gamesFor} onClose={() => setGamesFor(null)} onChanged={load} />}
    </div>
  );
}
