'use client';

// Exporta/importa só a programação de um campeonato (WODs, layouts de súmula e timeline).
// Não leva scores, placar, inscrições nem usuários. A importação sempre simula antes de gravar.

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileJson, RefreshCw, Upload, X, XCircle } from 'lucide-react';
import { apiClient, ApiError, ProgramImportReport } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  gameCode?: string;
  gameName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProgramTransferModal({ isOpen, gameCode, gameName, onClose, onSuccess }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [busy, setBusy] = useState<'simulate' | 'apply' | null>(null);
  const [fileName, setFileName] = useState('');
  const [pkg, setPkg] = useState<any | null>(null);
  const [report, setReport] = useState<ProgramImportReport | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setPkg(null);
    setReport(null);
    setFileName('');
  };

  const handleExport = async () => {
    if (!gameCode) return;
    setIsExporting(true);
    try {
      const data = await apiClient.exportProgram(gameCode);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `programacao-${gameCode}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Programação exportada: ${data.workouts.length} provas, ${data.heats.length} baterias, ${data.sumulaTemplates.length} layouts.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao exportar a programação');
    } finally {
      setIsExporting(false);
    }
  };

  const run = async (data: any, apply: boolean) => {
    if (!gameCode) return;
    setBusy(apply ? 'apply' : 'simulate');
    try {
      const res = await apiClient.importProgram(gameCode, data, apply);
      setReport(res);
      if (apply && res.applied) {
        storage.clearGameCache(gameCode);
        toast.success('Programação importada: WODs, súmulas e timeline atualizados.');
        onSuccess();
        onClose();
        reset();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao processar o pacote');
      setReport(null);
    } finally {
      setBusy(null);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        if (parsed?.kind !== 'itgames-program') {
          toast.error('Este arquivo não é um pacote de programação (talvez seja um backup completo).');
          return;
        }
        setFileName(file.name);
        setPkg(parsed);
        setReport(null);
        run(parsed, false); // sempre simula primeiro
      } catch {
        toast.error('O arquivo não contém um JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  const confirmApply = () => {
    if (!pkg || !report?.canApply) return;
    const s = report.summary;
    const ok = window.confirm(
      `Importar a programação em ${gameCode}?\n\n` +
        `• ${s.heats.remove} baterias atuais serão substituídas por ${s.heats.create} (${s.heats.lanes} raias)\n` +
        `• Provas: ${s.workouts.create} novas, ${s.workouts.update} alteradas\n` +
        `• Layouts de súmula: ${s.templates.create} novos, ${s.templates.update} atualizados\n\n` +
        'Inscrições, scores e placar não são alterados. Faça backup do banco antes.',
    );
    if (ok) run(pkg, true);
  };

  const pkgGame = pkg?.game?.code as string | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Programação do campeonato</h3>
            <p className="text-xs text-zinc-400">
              {gameName || gameCode} · WODs, layouts de súmula e timeline. Sem scores, placar, inscrições ou usuários.
            </p>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-3">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" /> Exportar daqui
            </div>
            <p className="text-xs text-zinc-400">Baixa um .json com as provas (ativas e inativas), os layouts usados e todas as baterias com horário, raia e dupla.</p>
            <button
              onClick={handleExport}
              disabled={isExporting || !gameCode}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? 'Exportando...' : 'Exportar programação'}
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-3">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-400" /> Importar aqui
            </div>
            <p className="text-xs text-zinc-400">Envie o .json exportado do outro sistema. Primeiro é feita uma simulação; nada é gravado sem a sua confirmação.</p>
            <label className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">
              {busy === 'simulate' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
              <span className="truncate">{busy === 'simulate' ? 'Simulando...' : fileName || 'Selecionar pacote .json'}</span>
              <input type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </div>

        {report && (
          <div className="space-y-4">
            <div
              className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold ${
                report.canApply ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {report.canApply ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {report.canApply ? 'Simulação ok: pode importar.' : 'Importação bloqueada: corrija os itens abaixo.'}
              {pkgGame && <span className="ml-auto text-zinc-400 font-normal">pacote de {pkgGame}</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-zinc-300">
              <div className="bg-zinc-950/60 border border-zinc-800 p-2.5 rounded-xl">
                <div className="text-zinc-500">Baterias</div>
                <div className="font-bold text-white">{report.summary.heats.remove} → {report.summary.heats.create}</div>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-800 p-2.5 rounded-xl">
                <div className="text-zinc-500">1ª / última largada</div>
                <div className="font-bold text-white">{report.summary.heats.start ?? '-'} – {report.summary.heats.end ?? '-'}</div>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-800 p-2.5 rounded-xl">
                <div className="text-zinc-500">Provas</div>
                <div className="font-bold text-white">+{report.summary.workouts.create} · ~{report.summary.workouts.update}</div>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-800 p-2.5 rounded-xl">
                <div className="text-zinc-500">Layouts de súmula</div>
                <div className="font-bold text-white">+{report.summary.templates.create} · ~{report.summary.templates.update}{report.summary.templates.skip ? ` · =${report.summary.templates.skip}` : ''}</div>
              </div>
            </div>

            {report.blockers.length > 0 && (
              <ul className="space-y-1 text-xs text-red-300">
                {report.blockers.map((b) => (
                  <li key={b} className="flex gap-2"><XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{b}</li>
                ))}
              </ul>
            )}

            {report.teamIssues.length > 0 && (
              <div className="rounded-xl border border-red-500/30 overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-red-500/10 text-red-200">
                    <tr><th className="text-left p-2">Dupla</th><th className="text-left p-2">Categoria</th><th className="text-left p-2">Problema</th></tr>
                  </thead>
                  <tbody>
                    {report.teamIssues.map((t) => (
                      <tr key={`${t.teamCode}-${t.problem}`} className="border-t border-zinc-800 text-zinc-300">
                        <td className="p-2">#{t.teamCode} {t.teamName}</td>
                        <td className="p-2">{t.category}</td>
                        <td className="p-2 text-red-300">{t.problem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {report.warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-amber-200/90">
                {report.warnings.map((w) => (
                  <li key={w} className="flex gap-2"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />{w}</li>
                ))}
              </ul>
            )}

            <button
              onClick={confirmApply}
              disabled={!report.canApply || busy !== null}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs flex items-center justify-center gap-2"
            >
              {busy === 'apply' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {busy === 'apply' ? 'Importando...' : 'Importar programação'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
