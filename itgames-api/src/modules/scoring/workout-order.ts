// Ordenação dentro de um WOD, portada de rankWorkout (leaderboard/board.ts) sem mudar o critério.

/** Resultado de uma equipe num WOD, já convertido para números. */
export interface WorkoutResult {
  time: number;
  reps: number;
  weight: number;
  tieBreak: number;
  penalty: number;
  /** for_time: terminou dentro do time cap. */
  completed: boolean;
}

/** Negativo quando `a` fica à frente de `b`; 0 é empate. */
export function compareWithinWorkout(type: string, a: WorkoutResult, b: WorkoutResult): number {
  if (type === 'for_time') {
    if (a.completed && !b.completed) return -1;
    if (!a.completed && b.completed) return 1;
    if (a.completed && b.completed) {
      const ta = a.time + a.penalty;
      const tb = b.time + b.penalty;
      return ta !== tb ? ta - tb : a.tieBreak - b.tieBreak;
    }
    return a.reps !== b.reps ? b.reps - a.reps : a.tieBreak - b.tieBreak;
  }
  if (type === 'amrap' || type === 'emom') {
    return a.reps !== b.reps ? b.reps - a.reps : a.tieBreak - b.tieBreak;
  }
  if (type === 'max_load' || type === 'complex') {
    return a.weight !== b.weight ? b.weight - a.weight : a.time - b.time;
  }
  if (type === 'hyrox_standard' || type === 'hyrox_relay') {
    return a.time + a.penalty - (b.time + b.penalty);
  }
  return 0;
}

/** "mm:ss", "hh:mm:ss" ou segundos → segundos; vazio vale 0. */
export function parseTime(value?: string | null): number {
  if (!value || !value.trim()) return 0;
  const clean = value.trim();
  const parts = clean.split(':').map((p) => parseFloat(p) || 0);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parseFloat(clean) || 0;
}

/** Segundos → "mm:ss" (com décimo quando houver). */
export function formatTime(total: number): string {
  // arredonda em décimos antes de separar minutos, segundos e décimo (65.96 => 01:06, nunca 01:05.10)
  const allTenths = Math.round(total * 10);
  const whole = Math.floor(allTenths / 10);
  const tenths = allTenths % 10;
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  const base = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return tenths > 0 ? `${base}.${tenths}` : base;
}
