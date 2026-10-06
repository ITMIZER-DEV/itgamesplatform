'use client';

import React from 'react';
import Link from 'next/link';
import { Flame, LogIn } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

// Barra mínima para visitantes: só marca, tema e acesso ao login (sem menus de módulos).
export function PublicTopBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 no-print backdrop-blur-md bg-zinc-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform">
            <Flame className="w-5 h-5 text-black fill-black" />
          </div>
          <span className="text-lg font-black tracking-wider text-white">
            IT<span className="text-amber-400">GAMES</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs shadow-md shadow-amber-500/20 transition-transform active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Entrar</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
