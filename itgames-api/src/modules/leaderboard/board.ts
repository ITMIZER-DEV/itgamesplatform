// Monta o placar pronto para a TV a partir de GET /events/:code/leaderboard.
// Regras de pontuação espelham itgames-platform/src/lib/scoring.ts + leaderboard-data.ts — ao mudar uma, mude a outra.

export interface BoardSource {
  game: { code: string; name: string; eventType?: string | null; location?: string | null };
  categories: { code: number; name: string }[];
  workouts: { code: number; category: number; title?: string | null; type?: string | null; timeCap?: string | null }[];
  teams: { code: number; categoryId: number; team: string; number?: string | null; athletes: string[] }[];
  scores: {
    idEvent: number;
    category: number;
    codeTeam: number;
    time?: string | null;
    weight?: string | null;
    reps?: string | null;
    penaltySeconds?: number | null;
    tieBreakTime?: string | null;
    isWO?: boolean | null;
  }[];
}

export interface BoardWod {
  title: string;
  display: string;
  rank: number;
  points: number;
}

export interface BoardRow {
  rank: number;
  team: string;
  number: string;
  athletes: string[];
  totalPoints: number;
  wods: BoardWod[];
}

export interface Board {
  game: { code: string; name: string; location: string; eventType: string };
  generatedAt: string;
  categories: { id: number; name: string; wodTitles: string[]; rows: BoardRow[] }[];
}

const CROSSFIT_POINTS = [
  100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 47, 44, 41, 38, 35, 32, 29, 26, 23, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 1,
];

export function pointsForRank(rank: number): number {
  if (rank <= 0) return 0;
  return rank <= CROSSFIT_POINTS.length ? CROSSFIT_POINTS[rank - 1] : 1;
}

export function parseTime(value?: string | null): number {
  if (!value || !value.trim()) return 0;
  const clean = value.trim();
  const parts = clean.split(':').map((p) => parseFloat(p) || 0);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parseFloat(clean) || 0;
}

export function formatTime(total: number): string {
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  const tenths = Math.round((total - Math.floor(total)) * 10);
  const base = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return tenths > 0 ? `${base}.${tenths}` : base;
}

interface Entry {
  teamCode: number;
  time: number;
  reps: number;
  weight: number;
  tieBreak: number;
  penalty: number;
  isWO: boolean;
  completed: boolean;
  rank: number;
  points: number;
}

function rankWorkout(type: string, entries: Entry[]): void {
  const valid = entries.filter((e) => !e.isWO);
  const invalid = entries.filter((e) => e.isWO);

  valid.sort((a, b) => {
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
  });

  let current = 1;
  valid.forEach((e, i) => {
    if (i > 0) {
      const p = valid[i - 1];
      const tied = e.time === p.time && e.reps === p.reps && e.weight === p.weight && e.tieBreak === p.tieBreak;
      if (!tied) current = i + 1;
    }
    e.rank = current;
    e.points = pointsForRank(current);
  });
  invalid.forEach((e) => {
    e.rank = valid.length + 1;
    e.points = 0;
  });
}

function display(type: string, e: Entry): string {
  if (e.isWO) return 'W.O.';
  const total = e.time + e.penalty;
  if (type === 'for_time') return e.completed ? formatTime(total) : `CAP +${e.reps}`;
  // a API não guarda rodadas separadas, só o total de repetições
  if (type === 'amrap') return `${e.reps} reps`;
  if (type === 'max_load' || type === 'complex') return `${e.weight} kg`;
  if (type === 'hyrox_standard' || type === 'hyrox_relay') return formatTime(total);
  return '-';
}

export function buildBoard(data: BoardSource, now: Date = new Date()): Board {
  const isHyrox = data.game.eventType === 'hyrox';

  const categories = data.categories.map((category) => {
    const workouts = data.workouts.filter((w) => w.category === category.code);
    const teams = data.teams.filter((t) => t.categoryId === category.code);

    // posição e pontos de cada WOD, entre as equipes da categoria
    const perWorkout = new Map<number, Map<number, Entry>>();
    for (const workout of workouts) {
      const cap = parseTime(workout.timeCap);
      const entries: Entry[] = data.scores
        .filter((s) => s.idEvent === workout.code && s.category === category.code)
        .map((s) => {
          const time = parseTime(s.time);
          return {
            teamCode: s.codeTeam,
            time,
            reps: parseInt(s.reps || '', 10) || 0,
            weight: parseFloat((s.weight || '').replace(',', '.')) || 0,
            tieBreak: parseTime(s.tieBreakTime),
            penalty: s.penaltySeconds || 0,
            isWO: !!s.isWO,
            completed: time > 0 && (cap === 0 || time <= cap),
            rank: 0,
            points: 0,
          };
        });
      rankWorkout(workout.type || 'for_time', entries);
      perWorkout.set(workout.code, new Map(entries.map((e) => [e.teamCode, e])));
    }

    const rows = teams.map((team) => {
      let totalPoints = 0;
      let totalTime = 0;
      const wods: BoardWod[] = workouts.map((workout) => {
        const entry = perWorkout.get(workout.code)?.get(team.code);
        if (!entry) return { title: workout.title || `WOD ${workout.code}`, display: 'Sem Score', rank: 0, points: 0 };
        totalPoints += entry.points;
        totalTime += entry.time + entry.penalty;
        return {
          title: workout.title || `WOD ${workout.code}`,
          display: display(workout.type || 'for_time', entry),
          rank: entry.rank,
          points: entry.points,
        };
      });
      return { team, totalPoints, totalTime, wods };
    });

    rows.sort((a, b) => {
      // HYROX: menor tempo vence; quem não tem tempo válido (sem score/W.O.) vai para o fim
      if (isHyrox) return (a.totalTime || Infinity) - (b.totalTime || Infinity) || 0;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const lastA = a.wods[a.wods.length - 1]?.rank || 999;
      const lastB = b.wods[b.wods.length - 1]?.rank || 999;
      return lastA - lastB;
    });

    return {
      id: category.code,
      name: category.name,
      wodTitles: workouts.map((w) => w.title || `WOD ${w.code}`),
      rows: rows.map((r, i) => ({
        rank: i + 1,
        // cadastros reais trazem espaços sobrando nos nomes
        team: r.team.team.trim(),
        number: (r.team.number || '').trim() || `#${r.team.code}`,
        athletes: r.team.athletes.map((a) => a.trim()).filter(Boolean),
        totalPoints: r.totalPoints,
        wods: r.wods,
      })),
    };
  });

  return {
    game: {
      code: data.game.code,
      name: data.game.name,
      location: data.game.location || '',
      eventType: isHyrox ? 'hyrox' : 'crossfit',
    },
    generatedAt: now.toISOString(),
    categories,
  };
}
