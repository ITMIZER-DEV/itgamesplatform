'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação não confere com a nova senha');
      return;
    }
    // o token vem na URL (?token=...); lido no envio, no cliente, como na tela de login
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      toast.error('Link inválido. Peça um novo link na tela de login.');
      return;
    }
    setIsLoading(true);
    try {
      await apiClient.resetPassword(token, newPassword);
      setDone(true);
      toast.success('Senha redefinida! Faça login com a nova senha.');
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível redefinir a senha');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl">
        <div className="space-y-1 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-white">Redefinir senha</h1>
          <p className="text-xs text-zinc-400">Escolha uma nova senha com no mínimo 8 caracteres.</p>
        </div>

        {done ? (
          <p className="text-sm text-emerald-300 text-center">Senha redefinida. Redirecionando para o login...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-50"
            >
              {isLoading ? 'Salvando...' : 'Redefinir senha'}
            </button>
            <div className="text-center">
              <Link href="/login" className="text-[11px] font-bold text-zinc-400 hover:text-white underline">
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
