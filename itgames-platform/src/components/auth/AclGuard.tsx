'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUserSession, hasPermission, UserRoleType } from '@/lib/acl';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';
import Link from 'next/link';

interface AclGuardProps {
  children: React.ReactNode;
  resource: 'admin' | 'judge' | 'athlete' | 'heats' | 'sumulas' | 'superadmin' | 'public';
  requiredRoleLabel?: string;
}

export function AclGuard({ children, resource, requiredRoleLabel }: AclGuardProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRoleType>('GUEST');

  useEffect(() => {
    const checkAuth = () => {
      const session = getCurrentUserSession();
      if (session.role !== 'GUEST' && session.mustChangePassword) {
        router.replace('/trocar-senha');
        return;
      }
      setCurrentRole(session.role);
      const allowed = hasPermission(session.role, resource);
      setIsAuthorized(allowed);
    };

    checkAuth();
    window.addEventListener('itgames_auth_changed', checkAuth);
    return () => window.removeEventListener('itgames_auth_changed', checkAuth);
  }, [resource]);

  if (isAuthorized === null) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-red-500/30 text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-black text-white">Acesso Restrito por Perfil</h2>
            <p className="text-xs text-zinc-400">
              Esta área é exclusiva para <strong>{requiredRoleLabel || 'usuários autorizados'}</strong>.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            Seu perfil atual: <span className="font-bold text-amber-400 uppercase">{currentRole}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Link
              href="/leaderboard"
              className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Link>

            <Link
              href="/login"
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Fazer Login</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
