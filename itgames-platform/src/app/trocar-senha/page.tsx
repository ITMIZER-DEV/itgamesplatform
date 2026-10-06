'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { getCurrentUserSession, homeForRole, saveSession } from '@/lib/acl';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (getCurrentUserSession().role === 'GUEST') {
      router.replace('/login');
    }
  }, [router]);

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

    setIsLoading(true);
    try {
      const res = await apiClient.changePassword(currentPassword, newPassword);
      saveSession(res);
      toast.success('Senha atualizada com sucesso!');
      router.push(homeForRole(res.user.role));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl"
      >
        <div className="space-y-1 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-white">Defina sua nova senha</h1>
          <p className="text-xs text-zinc-400">
            Por segurança, troque a senha temporária recebida do administrador antes de continuar.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-zinc-300">Senha atual (temporária)</span>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-zinc-300">Nova senha (mínimo 8 caracteres)</span>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-zinc-300">Confirmar nova senha</span>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-sm disabled:opacity-60"
        >
          {isLoading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
}
