import { Category, GameEvent, ScoreEntry, TeamRegistration, WorkoutRule } from '@/types';
import { calculateWorkoutRanks, parseTimeToSeconds } from './scoring';

// Resposta pública da API: GET /events/:code/leaderboard (sem dados pessoais)
export interface LeaderboardApiResponse {
  game: { code: string; name: string; eventType?: string | null; isLowestPointsBetter?: boolean; location?: string | null };
  categories: { code: number; name: string }[];
  workouts: { code: number; category: number; title?: string | null; type?: string | null; timeCap?: string | null; description?: string | null }[];
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

export interface LeaderboardView {
  game: GameEvent;
  categories: Category[];
  workouts: WorkoutRule[];
  teams: TeamRegistration[];
  scores: ScoreEntry[];
}

// Converte a resposta da API nos tipos usados pelo cálculo de ranking e calcula a posição em cada WOD.
export function buildLeaderboardView(data: LeaderboardApiResponse): LeaderboardView {
  const gameId = data.game.code;

  const game = {
    id: gameId,
    code: gameId,
    name: data.game.name,
    location: data.game.location || '',
    eventType: data.game.eventType === 'hyrox' ? 'hyrox' : 'crossfit',
  } as unknown as GameEvent;

  const categories = data.categories.map((c) => ({ id: String(c.code), gameId, name: c.name })) as unknown as Category[];

  const workouts: WorkoutRule[] = data.workouts.map((w) => ({
    id: String(w.code),
    gameId,
    categoryId: String(w.category),
    title: w.title || `WOD ${w.code}`,
    type: (w.type as WorkoutRule['type']) || 'for_time',
    timeCapSeconds: parseTimeToSeconds(w.timeCap || ''),
    description: w.description || '',
    movementStandards: [],
  }));

  const categoryName = (id: number) => data.categories.find((c) => c.code === id)?.name || String(id);

  const teams = data.teams.map((t) => ({
    id: String(t.code),
    gameId,
    categoryId: String(t.categoryId),
    categoryName: categoryName(t.categoryId),
    teamName: t.team,
    registerNumber: t.number || `#${t.code}`,
    amountPaid: 0,
    paymentStatus: 'pending',
    registeredAt: '',
    checkedIn: false,
    athletes: t.athletes.map((name, i) => ({ id: `${t.code}-${i}`, name })),
    validationStatus: 'valid',
  })) as unknown as TeamRegistration[];

  const toEntry = (s: LeaderboardApiResponse['scores'][number]): ScoreEntry => {
    const workout = workouts.find((w) => w.id === String(s.idEvent));
    const timeSeconds = parseTimeToSeconds(s.time || '');
    const cap = workout?.timeCapSeconds || 0;
    const team = data.teams.find((t) => t.code === s.codeTeam);
    return {
      id: `${s.codeTeam}-${s.idEvent}`,
      gameId,
      workoutId: String(s.idEvent),
      categoryId: String(s.category),
      registrationId: String(s.codeTeam),
      teamName: team?.team || '',
      registerNumber: team?.number || `#${s.codeTeam}`,
      judgeName: '',
      timeFormatted: s.time || undefined,
      timeSeconds,
      repsCount: parseInt(s.reps || '', 10) || 0,
      roundsCount: 0,
      weightLoadedKg: parseFloat((s.weight || '').replace(',', '.')) || 0,
      tieBreakSeconds: parseTimeToSeconds(s.tieBreakTime || ''),
      penaltiesSeconds: s.penaltySeconds || 0,
      isCompleted: timeSeconds > 0 && (cap === 0 || timeSeconds <= cap),
      isWO: !!s.isWO,
      isDisqualified: false,
      scoreStatus: 'approved_by_head_judge',
      submittedAt: '',
    };
  };

  // posição e pontos de cada WOD são calculados entre as equipes da mesma categoria
  const entries = data.scores.map(toEntry);
  const scores: ScoreEntry[] = [];
  for (const workout of workouts) {
    const group = entries.filter((e) => e.workoutId === workout.id && e.categoryId === workout.categoryId);
    scores.push(...calculateWorkoutRanks(workout, group));
  }

  return { game, categories, workouts, teams, scores };
}
