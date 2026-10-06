'use client';

import React, { useEffect, useState } from 'react';
import { Copy, KeyRound, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, AthleteAdminRow } from '@/lib/api-client';

interface IssuedPassword {
  name: string;
  email: string;
  password: string;
}

// Aba "Atletas" do admin (só super admin): busca e geração de senha temporária para quem não recebe e-mail
export function AthletesPanel() {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState(''); // termo já aplicado na busca
  const [athletes, setAthletes] = useState<AthleteAdminRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);

  useEffect(() => {
    apiClient
      .listAthletes(query || undefined)
      .then(setAthletes)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar atletas'))
      .finally(() => setIsLoading(false));
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setQuery(term.trim());
  };

  const handleReset = async (a: AthleteAdminRow) => {
    if (!window.confirm(`Gerar uma nova senha temporária para ${a.name}? A senha atual deixa de valer.`)) return;
    try {
      const res = await apiClient.resetAthletePassword(a.id);
      setIssued({ name: res.user.name, email: res.user.email, password: res.temporaryPassword });
      setAthletes((list) => list.map((x) => (x.id === a.id ? { ...x, mustChangePassword: true } : x)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao gerar a senha temporária');
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
    'flex-1 bg-zinc-950 border border-zinc-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center gap-3">
        <input
          className={inputClass}
          value={term}
          placeholder="Buscar por nome, e-mail ou CPF"
          onChange={(e) => setTerm(e.target.value)}
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          <span>Buscar</span>
        </button>
      </form>

      {issued && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/40 space-y-3">
          <div className="text-sm font-black text-amber-300">Senha temporária de {issued.name}</div>
          <p className="text-xs text-zinc-300">
            Repasse ao atleta ({issued.email}). Ela só é exibida agora e precisará ser trocada no primeiro acesso.
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
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px]">
            <tr>
              <th className="text-left px-4 py-3">Atleta</th>
              <th className="text-left px-4 py-3">CPF</th>
              <th className="text-left px-4 py-3">Telefone</th>
              <th className="text-left px-4 py-3">Senha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-zinc-500">Carregando...</td>
              </tr>
            )}
            {!isLoading && athletes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-zinc-500">Nenhum atleta encontrado.</td>
              </tr>
            )}
            {athletes.map((a) => (
              <tr key={a.id} className="border-t border-zinc-800">
                <td className="px-4 py-3">
                  <div className="font-bold text-white">{a.name}</div>
                  <div className="text-zinc-400 font-mono">{a.email}</div>
                </td>
                <td className="px-4 py-3 text-zinc-300 font-mono">{a.cpfMasked ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-300">{a.phoneNumber || '—'}</td>
                <td className="px-4 py-3">
                  {a.mustChangePassword ? (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      Temporária
                    </span>
                  ) : (
                    <span className="text-zinc-500">Definida</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleReset(a)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold flex items-center gap-1.5 ml-auto"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Gerar senha temporária</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
