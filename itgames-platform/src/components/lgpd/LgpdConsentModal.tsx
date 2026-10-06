'use client';

import React, { useState } from 'react';
import { ShieldCheck, Lock, FileText, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { LGPD_TERMS_OF_USE } from '@/lib/lgpd';
import { toast } from 'sonner';

interface LgpdConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  athleteName: string;
}

export function LgpdConsentModal({ isOpen, onClose, onAccept, athleteName }: LgpdConsentModalProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedImage, setAcceptedImage] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!acceptedTerms || !acceptedImage) {
      toast.error('Por favor, marque os dois consentimentos obrigatórios antes de confirmar.');
      return;
    }
    toast.success('Consentimento LGPD registrado com sucesso na trilha de auditoria!');
    onAccept();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl">
        
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
            <div>
              <h3 className="text-base font-bold text-white">
                {LGPD_TERMS_OF_USE.title}
              </h3>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                Conformidade Lei nº 13.709/2018 (Versão {LGPD_TERMS_OF_USE.version})
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        {/* RESUMO EXECUTIVO */}
        <div className="space-y-3 text-xs">
          <p className="text-zinc-300 leading-relaxed bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800">
            {LGPD_TERMS_OF_USE.summary}
          </p>

          <div className="space-y-2">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Diretrizes de Proteção de Dados:
            </h4>
            <ul className="space-y-1.5 text-zinc-400 list-disc list-inside">
              {LGPD_TERMS_OF_USE.points.map((point, index) => (
                <li key={index} className="leading-tight">{point}</li>
              ))}
            </ul>
          </div>

          {/* CHECKBOXES DE CONSENTIMENTO EXPLÍCITO */}
          <div className="space-y-2.5 pt-3 border-t border-zinc-800">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 rounded accent-emerald-500 w-4 h-4"
              />
              <span className="text-zinc-300 text-[11px] leading-tight">
                Eu, <strong className="text-white">{athleteName}</strong>, declaro que li e concordo com o tratamento dos meus dados pessoais necessários para a organização e cronometragem da prova.
              </span>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
              <input
                type="checkbox"
                checked={acceptedImage}
                onChange={(e) => setAcceptedImage(e.target.checked)}
                className="mt-0.5 rounded accent-emerald-500 w-4 h-4"
              />
              <span className="text-zinc-300 text-[11px] leading-tight">
                Autorizo a exibição do meu nome, foto de súmula de campo e pontuação nos telões ao vivo e plataformas da competição.
              </span>
            </label>
          </div>
        </div>

        {/* BOTÕES */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Aceitar e Confirmar Inscrição</span>
          </button>
        </div>

      </div>
    </div>
  );
}
