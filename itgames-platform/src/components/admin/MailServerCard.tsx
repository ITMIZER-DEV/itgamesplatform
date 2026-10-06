'use client';

import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, MailSettings } from '@/lib/api-client';

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500';

interface Props {
  onSaved: () => void;
}

export function MailServerCard({ onSaved }: Props) {
  const [form, setForm] = useState<MailSettings | null>(null);
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    apiClient
      .getMailSettings()
      .then(setForm)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar a configuração de e-mail'));
  }, []);

  if (!form) {
    return <div className="glass-panel rounded-3xl p-6 border border-zinc-800 text-xs text-zinc-500">Carregando...</div>;
  }

  const set = <K extends keyof MailSettings>(key: K, value: MailSettings[K]) => setForm({ ...form, [key]: value });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const saved = await apiClient.saveMailSettings({
        enabled: form.enabled,
        host: form.host,
        port: Number(form.port),
        secure: form.secure,
        username: form.username,
        fromName: form.fromName,
        fromAddress: form.fromAddress,
        appBaseUrl: form.appBaseUrl,
        ...(password ? { password } : {}),
      });
      setForm(saved);
      setPassword('');
      toast.success('Configuração de e-mail salva');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao salvar a configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await apiClient.testMailSettings();
      setTestResult(result);
      if (result.ok) toast.success('E-mail de teste enviado para o seu endereço');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao testar o envio');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">Servidor de envio (SMTP)</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Google Workspace: servidor <strong>smtp.gmail.com</strong>, porta <strong>587</strong> (STARTTLS) ou{' '}
            <strong>465</strong> (SSL), usuário e <strong>senha de app</strong> (exige verificação em duas etapas). O
            remetente deve ser a própria conta ou um alias dela.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-300 shrink-0">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          Envio de e-mails ativo
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="sm:col-span-2">
          <label className="font-bold text-zinc-300 block mb-1">Servidor</label>
          <input className={inputClass} value={form.host} onChange={(e) => set('host', e.target.value)} />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Porta</label>
          <input
            className={inputClass}
            type="number"
            value={form.port}
            onChange={(e) => set('port', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Segurança</label>
          <select
            className={inputClass}
            value={form.secure}
            onChange={(e) => set('secure', e.target.value as 'starttls' | 'ssl')}
          >
            <option value="starttls">STARTTLS (587)</option>
            <option value="ssl">SSL (465)</option>
          </select>
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Usuário</label>
          <input
            className={inputClass}
            value={form.username}
            placeholder="envio@seudominio.com.br"
            onChange={(e) => set('username', e.target.value)}
          />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Senha de app</label>
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={password}
            placeholder={form.passwordSet ? '•••••••• (definida — deixe vazio para manter)' : 'Cole a senha de app'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Nome do remetente</label>
          <input className={inputClass} value={form.fromName} onChange={(e) => set('fromName', e.target.value)} />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">E-mail do remetente</label>
          <input
            className={inputClass}
            type="email"
            value={form.fromAddress}
            placeholder="envio@seudominio.com.br"
            onChange={(e) => set('fromAddress', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="font-bold text-zinc-300 block mb-1">URL do sistema (usada nos links dos e-mails)</label>
          <input
            className={inputClass}
            value={form.appBaseUrl}
            placeholder="https://arena.seudominio.com.br"
            onChange={(e) => set('appBaseUrl', e.target.value)}
          />
        </div>
      </div>

      {testResult && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            testResult.ok
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/10 border-red-500/40 text-red-300'
          }`}
        >
          {testResult.ok ? 'Teste enviado com sucesso.' : `Falha no teste: ${testResult.error}`}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          title="Salve antes de testar: o teste usa a configuração salva"
        >
          <Send className="w-3.5 h-3.5" />
          {isTesting ? 'Enviando...' : 'Testar envio'}
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
