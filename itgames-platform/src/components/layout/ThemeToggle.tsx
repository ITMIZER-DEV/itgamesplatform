'use client';

import React, { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'itgames_theme';
const EVENT = 'itgames_theme_changed';

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function getServerSnapshot(): Theme {
  return 'dark';
}

/** Tema atual ('dark' | 'light'), atualizado quando o usuário troca. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const theme = useTheme();
  const isLight = theme === 'light';

  const toggle = () => {
    const next: Theme = isLight ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // armazenamento indisponível: o tema vale só nesta visita
    }
    window.dispatchEvent(new Event(EVENT));
  };

  const label = isLight ? 'Ativar tema escuro' : 'Ativar tema claro';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isLight}
      title={label}
      className={`no-print inline-flex items-center gap-2 px-2.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-colors ${
        floating ? 'fixed top-3 right-3 z-50' : ''
      }`}
    >
      {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      <span className="hidden xl:inline">{isLight ? 'Escuro' : 'Claro'}</span>
    </button>
  );
}
