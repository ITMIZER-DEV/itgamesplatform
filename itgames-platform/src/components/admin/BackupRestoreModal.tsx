'use client';

import React, { useState } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  FileJson, 
  X 
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BackupRestoreModal({ isOpen, onClose, onSuccess }: BackupRestoreModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await apiClient.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itgames-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup exportado com sucesso! Arquivo JSON baixado.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao exportar backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Selecione um arquivo de snapshot válido no formato .json');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setImportPreview(parsed);
      } catch {
        toast.error('O arquivo selecionado não contém um JSON válido.');
        setImportPreview(null);
        setSelectedFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importPreview) {
      toast.error('Nenhum arquivo de snapshot válido selecionado.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await apiClient.importBackup(importPreview);
      toast.success(res?.message || 'Snapshot restaurado com sucesso no banco de dados!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao restaurar snapshot no banco.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Backup & Sincronização de Dados</h3>
              <p className="text-xs text-zinc-400">Exporte ou restaure snapshots completos do banco de dados</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CARDS DE AÇÃO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* EXPORTAR */}
          <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Download className="w-4 h-4" />
                <span>Exportar Snapshot (.json)</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Baixa um arquivo completo com todos os campeonatos, categorias, atletas, baterias e pontuações atuais.
              </p>
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isExporting ? 'Exportando...' : 'Baixar Backup Atual'}</span>
            </button>
          </div>

          {/* IMPORTAR */}
          <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                <Upload className="w-4 h-4" />
                <span>Restaurar Snapshot (.json)</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Carrega dados de outro servidor ou arquivo de seed prévio com mesclagem inteligente (upsert).
              </p>
            </div>

            <label className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/20 cursor-pointer text-center">
              <FileJson className="w-4 h-4" />
              <span>{selectedFile ? selectedFile.name : 'Selecionar Arquivo .json'}</span>
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
          </div>
        </div>

        {/* PRÉ-VISUALIZAÇÃO DA IMPORTAÇÃO */}
        {importPreview && (
          <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30 space-y-3">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Snapshot carregado e pronto para restauração:</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-zinc-300">
              <div className="bg-zinc-900/80 p-2 rounded-lg">Usuários: <strong>{importPreview.users?.length || 0}</strong></div>
              <div className="bg-zinc-900/80 p-2 rounded-lg">Eventos: <strong>{importPreview.games?.length || 0}</strong></div>
              <div className="bg-zinc-900/80 p-2 rounded-lg">Categorias: <strong>{importPreview.categories?.length || 0}</strong></div>
              <div className="bg-zinc-900/80 p-2 rounded-lg">Inscrições: <strong>{importPreview.registrations?.length || 0}</strong></div>
            </div>

            <button
              onClick={handleImport}
              disabled={isImporting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-amber-500/20"
            >
              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{isImporting ? 'Processando Restauração...' : 'Confirmar e Restaurar no Banco de Dados'}</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>A importação utiliza <strong>upsert</strong> (atualiza existentes e cria novos sem apagar outros registros).</span>
        </div>
      </div>
    </div>
  );
}
