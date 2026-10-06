'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient, ApiError, MailTemplateInfo } from '@/lib/api-client';

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500';

function TemplateEditor({ tpl, onChanged }: { tpl: MailTemplateInfo; onChanged: () => void }) {
  const [enabled, setEnabled] = useState(tpl.enabled);
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [preview, setPreview] = useState<{ subject: string; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const run = async (fn: () => Promise<void>, errorMessage: string) => {
    setIsBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : errorMessage);
    } finally {
      setIsBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      await apiClient.saveMailTemplate(tpl.type, { enabled, subject, body });
      toast.success('Texto salvo');
      onChanged();
    }, 'Falha ao salvar o texto');

  const restore = () =>
    run(async () => {
      const def = await apiClient.resetMailTemplate(tpl.type);
      setEnabled(def.enabled);
      setSubject(def.subject);
      setBody(def.body);
      setPreview(null);
      toast.success('Texto padrão restaurado');
      onChanged();
    }, 'Falha ao restaurar o texto padrão');

  const showPreview = () =>
    run(async () => setPreview(await apiClient.previewMailTemplate(tpl.type, { subject, body })), 'Falha ao gerar a prévia');

  return (
    <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-white">{tpl.label}</h4>
          {tpl.custom && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
              Editado
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-300">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enviar este e-mail
        </label>
      </div>

      <div>
        <label className="text-[11px] font-bold text-zinc-400 block mb-1">Assunto</label>
        <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label className="text-[11px] font-bold text-zinc-400 block mb-1">Mensagem</label>
        <textarea className={`${inputClass} font-mono min-h-[140px]`} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <p className="text-[11px] text-zinc-500">
        Variáveis disponíveis:{' '}
        {tpl.variables.map((v) => (
          <code key={v} className="mr-1.5 px-1 py-0.5 rounded bg-zinc-800 text-amber-300">{`{{${v}}}`}</code>
        ))}
      </p>

      {preview && (
        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1">
          <div className="text-zinc-400">
            Assunto: <strong className="text-white">{preview.subject}</strong>
          </div>
          {/* texto puro: nada é interpretado como HTML na tela */}
          <div className="text-zinc-200 whitespace-pre-wrap">{preview.text}</div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {tpl.custom && (
          <button
            type="button"
            onClick={restore}
            disabled={isBusy}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
          >
            Restaurar padrão
          </button>
        )}
        <button
          type="button"
          onClick={showPreview}
          disabled={isBusy}
          className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold"
        >
          Prévia
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isBusy}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-50"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

export function MailTemplatesCard() {
  const [templates, setTemplates] = useState<MailTemplateInfo[] | null>(null);

  const load = useCallback(async () => {
    try {
      setTemplates(await apiClient.listMailTemplates());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar os tipos de e-mail');
    }
  }, []);

  useEffect(() => {
    apiClient
      .listMailTemplates()
      .then(setTemplates)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar os tipos de e-mail'));
  }, []);

  return (
    <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
      <h3 className="text-base font-bold text-white">Tipos de e-mail</h3>
      {!templates && <div className="text-xs text-zinc-500">Carregando...</div>}
      {templates?.map((tpl) => (
        // a key inclui custom e o texto para remontar o editor depois de salvar/restaurar
        <TemplateEditor key={`${tpl.type}-${tpl.custom}-${tpl.subject.length}-${tpl.body.length}`} tpl={tpl} onChanged={load} />
      ))}
    </div>
  );
}
