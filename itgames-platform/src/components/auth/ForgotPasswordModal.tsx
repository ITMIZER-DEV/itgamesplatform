'use client';

import React, { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';

interface Props {
  initialEmail?: string;
  onClose: () => void;
}

export function ForgotPasswordModal({ initialEmail = '', onClose }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Informe o seu e-mail');
      return;
    }
    setIsSending(true);
    try {
      await apiClient.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white">Esqueci minha senha</h3>
            <p className="text-xs text-zinc-400">Enviaremos um link para você criar uma nova senha.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-sm text-emerald-300">
            Se o e-mail estiver cadastrado, você receberá as instruções em instantes. Confira também a caixa de spam.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSending}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-50"
            >
              {isSending ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
