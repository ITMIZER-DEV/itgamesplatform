// Regras de tempo das baterias: time cap, descanso entre provas A/B e agrupamento por WOD.

export function parseTimeCapMinutes(timeCap?: string | null, fallback = 10): number {
  if (!timeCap || !timeCap.trim()) return fallback;
  const raw = timeCap.trim().toLowerCase();
  const mmss = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (mmss) {
    const mins = Number(mmss[1]);
    const secs = Number(mmss[2]);
    return Math.max(1, mins + (secs > 0 ? 1 : 0));
  }
  const numMatch = raw.match(/(\d+)/);
  if (numMatch) {
    return Math.max(1, Number(numMatch[1]));
  }
  return fallback;
}

/**
 * Descanso entre as provas A e B, lido da descrição da prova B.
 * Aceita "Rest 1'", "Após 4' de Rest", "Rest: 2 min", "3 min de descanso".
 * Sem menção na descrição, usa o fallback.
 */
export function parseRestMinutes(description?: string | null, fallback = 1): number {
  const text = String(description || '');
  const m =
    text.match(/\b(?:rest|descanso)\s*:?\s*(\d+)\s*(?:'|min)/i) ||
    text.match(/\b(\d+)\s*(?:'|min(?:utos?)?)\s*(?:de\s+)?(?:rest|descanso)\b/i);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function extractWodBlockKey(title?: string | null, fallbackCode?: number): string {
  const raw = (title || '').trim();
  const m = raw.match(/(?:WOD|PROVA|EVENT)\s*(\d+)(?:\s*[.\-_]\s*[A-Za-z0-9]+)?/i);
  if (m && m[1]) {
    return `block_${m[1]}`;
  }
  return `single_${fallbackCode ?? raw}`;
}

/** Ordem das categorias na arena (Iniciante → Scaled Fem → Scaled Masc → Amador → demais). */
export function categoryArenaOrder(name?: string | null, code?: number): number {
  const n = (name || '').toLowerCase();
  if (n.includes('iniciante') && n.includes('fem')) return 1;
  if (n.includes('scaled') && n.includes('fem')) return 2;
  if (n.includes('scaled') && n.includes('masc')) return 3;
  if (n.includes('amador') && n.includes('mist')) return 4;
  return 100 + (code ?? 0);
}
