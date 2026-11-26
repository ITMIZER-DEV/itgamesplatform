'use client';

import { useEffect } from 'react';

// Seleção operacional compartilhada entre as telas do dia da prova
// (Baterias, Súmulas, Mesa do Head Judge, App do Juiz, Leaderboard).
// Quem escolhe "Categoria X • WOD Y • Bateria Z" numa tela encontra a mesma escolha
// ao abrir a próxima, sem precisar selecionar tudo de novo.
// É só uma conveniência por navegador: fica no localStorage, por campeonato.

export interface ArenaSelection {
  categoryId?: string;
  workoutId?: string;
  heat?: string;
}

const KEY_PREFIX = 'itgames_arena_selection_';
export const ARENA_SELECTION_EVENT = 'itgames_arena_selection_changed';

export function getArenaSelection(gameCode?: string | null): ArenaSelection {
  if (!gameCode || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + gameCode);
    return raw ? (JSON.parse(raw) as ArenaSelection) : {};
  } catch {
    return {};
  }
}

export function setArenaSelection(gameCode: string | null | undefined, patch: ArenaSelection): void {
  if (!gameCode || typeof window === 'undefined') return;
  const current = getArenaSelection(gameCode);
  const next: ArenaSelection = { ...current };
  (Object.keys(patch) as (keyof ArenaSelection)[]).forEach((k) => {
    const v = patch[k];
    if (v !== undefined && v !== null && String(v) !== '') next[k] = String(v);
  });
  if (
    next.categoryId === current.categoryId &&
    next.workoutId === current.workoutId &&
    next.heat === current.heat
  ) {
    return;
  }
  try {
    window.localStorage.setItem(KEY_PREFIX + gameCode, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(ARENA_SELECTION_EVENT, { detail: { gameCode, selection: next } }));
  } catch {
    // armazenamento indisponível (aba anônima, bloqueio): a tela segue funcionando sem lembrar
  }
}

/** Escolhe o primeiro id da lista que existe nas opções (comparação por string). */
export function pickExisting<T extends { id: string | number }>(
  options: T[],
  ...candidates: (string | number | null | undefined)[]
): string {
  for (const c of candidates) {
    if (c === undefined || c === null || String(c) === '') continue;
    const hit = options.find((o) => String(o.id) === String(c));
    if (hit) return String(hit.id);
  }
  return options[0] ? String(options[0].id) : '';
}

/**
 * Grava a seleção da tela sempre que ela muda (ignora valores vazios).
 * Passe `ready = false` enquanto a tela ainda carrega, para que um valor padrão
 * provisório não sobrescreva o que outra tela deixou.
 */
export function usePersistArenaSelection(
  gameCode: string | null | undefined,
  selection: ArenaSelection,
  ready = true,
): void {
  const { categoryId, workoutId, heat } = selection;
  useEffect(() => {
    if (!ready) return;
    setArenaSelection(gameCode, { categoryId, workoutId, heat });
  }, [gameCode, categoryId, workoutId, heat, ready]);
}
