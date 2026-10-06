'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, MailLogEntry } from '@/lib/api-client';

const STATUS_STYLE: Record<string, string> = {
  sent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  skipped: 'bg-zinc-700/40 text-zinc-300 border-zinc-600',
};
const STATUS_LABEL: Record<string, string> = { sent: 'Enviado', failed: 'Falhou', skipped: 'Ignorado' };

interface Props {
  // muda quando algo foi salvo/testado, para recarregar a lista
  refreshKey: number;
}

export function MailLogsCard({ refreshKey }: Props) {
  const [logs, setLogs] = useState<MailLogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLogs(await apiClient.listMailLogs(filter || undefined));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar o histórico');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  // refreshKey não é usado no corpo: só faz o efeito rodar de novo quando algo foi salvo/testado
  useEffect(() => {
    apiClient
      .listMailLogs(filter || undefined)
      .then(setLogs)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar o histórico'))
      .finally(() => setIsLoading(false));
  }, [filter, refreshKey]);

  const resend = async (id: string) => {
    try {
      const res = await apiClient.resendMailLog(id);
      if (res.status === 'sent') toast.success('E-mail reenviado');
      else toast.error(`Não foi possível reenviar: ${res.error ?? res.status}`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao reenviar');
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-white">Histórico de envios</h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 text-xs text-white rounded-xl px-3 py-2"
          >
            <option value="">Todos</option>
            <option value="failed">Falharam</option>
            <option value="sent">Enviados</option>
            <option value="skipped">Ignorados</option>
          </select>
          <button onClick={load} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300" title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-zinc-500 uppercase text-[10px]">
            <tr>
              <th className="py-2 pr-3">Data</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Destinatário</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-3 text-zinc-500">Carregando...</td>
              </tr>
            )}
            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-zinc-500">Nenhum envio registrado.</td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-zinc-800 align-top">
                <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
                <td className="py-2 pr-3 text-zinc-200">{l.type}</td>
                <td className="py-2 pr-3 text-zinc-300 font-mono">{l.toAddress}</td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${STATUS_STYLE[l.status] ?? ''}`}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </span>
                  {l.error && <div className="text-[11px] text-red-300 mt-1 max-w-xs break-words">{l.error}</div>}
                </td>
                <td className="py-2 text-right">
                  {l.status !== 'sent' && (
                    <button
                      onClick={() => resend(l.id)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold"
                    >
                      Reenviar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
