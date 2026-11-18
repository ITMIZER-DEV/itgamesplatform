import { Category, LeaderboardRank, ScoreEntry, TeamRegistration, WorkoutRule } from '@/types';
import { sortWorkoutsNaturally } from '@/lib/board';

export const DEFAULT_POINTS_TABLE = [
  100, 94, 88, 84, 80, 76, 72, 68, 64, 60,
  58, 56, 54, 52, 50, 48, 46, 44, 42, 40,
  38, 36, 34, 32, 30, 28, 26, 24, 22, 20,
];

export interface WorkoutRankRow {
  team: TeamRegistration;
  score: ScoreEntry | null;
  rank: number;
  points: number;
  displayValue: string;
  sortKey: number;
}

export interface CategoryStandingResult {
  category: Category;
  workouts: WorkoutRule[];
  ranks: (LeaderboardRank & { tiebreakNote?: string })[];
  wodResultsByWorkoutId: Record<string, WorkoutRankRow[]>;
  updatedScores: ScoreEntry[];
}

function getWorkoutKind(workout: WorkoutRule): 'max_load' | 'amrap' | 'for_time' {
  const titleLower = (workout.title || '').toLowerCase();
  if (
    workout.type === 'max_load' ||
    workout.type === 'complex' ||
    titleLower.includes('lift') ||
    titleLower.includes('hang clean') ||
    titleLower.includes('carga') ||
    /\bwod\s*3\b|\bprova\s*3\b/.test(titleLower)
  ) {
    return 'max_load';
  }
  if (
    workout.type === 'amrap' ||
    workout.type === 'emom' ||
    titleLower.includes('death by') ||
    titleLower.includes('1-b') ||
    titleLower.includes('1b')
  ) {
    return 'amrap';
  }
  return 'for_time';
}

function formatScoreDisplay(score: ScoreEntry | null, kind: 'max_load' | 'amrap' | 'for_time'): string {
  if (!score) return '-';
  if (score.isWO) return 'W.O.';
  if (score.isDisqualified) return 'D.Q.';
  if (score.timeFormatted && score.timeFormatted.trim()) return score.timeFormatted;
  if (kind === 'max_load') {
    return score.weightLoadedKg !== undefined ? `${score.weightLoadedKg} kg` : '-';
  }
  if (kind === 'amrap') {
    if (score.roundsCount !== undefined) {
      return score.repsCount ? `${score.roundsCount} rds + ${score.repsCount}` : `${score.roundsCount} rounds`;
    }
    if (score.repsCount !== undefined) return `${score.repsCount} reps`;
  }
  if (score.repsCount !== undefined && !score.isCompleted) return `CAP +${score.repsCount}`;
  return score.repsCount !== undefined ? `${score.repsCount} reps` : '-';
}

/**
 * Calcula a colocação e pontuação de todas as equipes inscritas em uma prova (WOD),
 * considerando W.O., D.Q., Time Cap + repetições faltantes, rounds e carga máxima.
 */
export function computeWorkoutRanking(
  workout: WorkoutRule,
  teams: TeamRegistration[],
  scores: ScoreEntry[],
  pointsTable: number[] = DEFAULT_POINTS_TABLE,
): { rows: WorkoutRankRow[]; updatedScores: ScoreEntry[] } {
  const kind = getWorkoutKind(workout);
  const categoryTeams = teams.filter(
    (t) => t.categoryId === workout.categoryId || t.paymentStatus !== 'cancelled',
  );
  const activeTeams = categoryTeams.filter((t) => t.categoryId === workout.categoryId || !workout.categoryId);

  const rawRows = activeTeams.map((team) => {
    const score =
      scores.find((s) => s.workoutId === workout.id && s.registrationId === team.id) || null;
    const penaltySec = score?.penaltiesSeconds || 0;

    if (!score || score.isWO || score.isDisqualified) {
      return {
        team,
        score,
        hasResult: false,
        isDisqualifiedOrWo: Boolean(score && (score.isWO || score.isDisqualified)),
        sortKey: Number.MAX_SAFE_INTEGER,
        primaryMetric: 0,
        secondaryMetric: 0,
        displayValue: formatScoreDisplay(score, kind),
      };
    }

    if (kind === 'max_load') {
      const weight = score.weightLoadedKg ?? 0;
      // Maior carga vence; usamos valor negativo para ordenação crescente uniforme
      return {
        team,
        score,
        hasResult: weight > 0 || Boolean(score.timeFormatted),
        isDisqualifiedOrWo: false,
        sortKey: -weight,
        primaryMetric: weight,
        secondaryMetric: 0,
        displayValue: formatScoreDisplay(score, kind),
      };
    }

    if (kind === 'amrap') {
      const rounds = score.roundsCount ?? 0;
      const reps = score.repsCount ?? 0;
      const totalPerformance = rounds * 10000 + reps - penaltySec;
      return {
        team,
        score,
        hasResult: true,
        isDisqualifiedOrWo: false,
        sortKey: -totalPerformance,
        primaryMetric: rounds,
        secondaryMetric: reps,
        displayValue: formatScoreDisplay(score, kind),
      };
    }

    // For Time / Time Cap: concluintes primeiro (menor tempo + penalidades), depois quem deu CAP (menor falta)
    const isCap = score.isCompleted === false || (score.timeFormatted || '').toUpperCase().includes('CAP');
    if (!isCap) {
      const secs = (score.timeSeconds ?? 99999) + penaltySec;
      return {
        team,
        score,
        hasResult: true,
        isDisqualifiedOrWo: false,
        sortKey: secs,
        primaryMetric: secs,
        secondaryMetric: 0,
        displayValue: formatScoreDisplay(score, kind),
      };
    }

    const capSeconds = (workout.timeCapSeconds || 600) + 100000;
    const missing = (score.repsCount ?? 0) + penaltySec;
    return {
      team,
      score,
      hasResult: true,
      isDisqualifiedOrWo: false,
      sortKey: capSeconds + missing,
      primaryMetric: missing,
      secondaryMetric: score.tieBreakSeconds ?? 0,
      displayValue: formatScoreDisplay(score, kind),
    };
  });

  rawRows.sort((a, b) => {
    if (a.hasResult !== b.hasResult) return a.hasResult ? -1 : 1;
    if (a.isDisqualifiedOrWo !== b.isDisqualifiedOrWo) return a.isDisqualifiedOrWo ? 1 : -1;
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.team.teamName.localeCompare(b.team.teamName);
  });

  let currentRank = 1;
  const rows: WorkoutRankRow[] = rawRows.map((item, idx) => {
    if (idx > 0) {
      const prev = rawRows[idx - 1];
      if (!item.hasResult || item.sortKey !== prev.sortKey || item.isDisqualifiedOrWo !== prev.isDisqualifiedOrWo) {
        currentRank = idx + 1;
      }
    }
    const pts =
      !item.hasResult || item.isDisqualifiedOrWo
        ? 0
        : pointsTable[currentRank - 1] ?? Math.max(0, 40 - (currentRank - pointsTable.length) * 2);

    return {
      team: item.team,
      score: item.score,
      rank: currentRank,
      points: pts,
      displayValue: item.displayValue,
      sortKey: item.sortKey,
    };
  });

  const updatedScores: ScoreEntry[] = rows
    .filter((r) => r.score !== null)
    .map((r) => ({
      ...(r.score as ScoreEntry),
      rankInWorkout: r.rank,
      finalPoints: r.points,
    }));

  return { rows, updatedScores };
}

/**
 * Compara duas equipes empatadas em pontuação total aplicando o critério oficial
 * Summer Games Interbox: melhores colocações individuais sucessivas e, persistindo,
 * a colocação obtida na última prova disputada.
 */
function compareTiebreak(ranksA: number[], ranksB: number[]): { diff: number; reason?: string } {
  const sortedA = [...ranksA].sort((a, b) => a - b);
  const sortedB = [...ranksB].sort((a, b) => a - b);
  const len = Math.max(sortedA.length, sortedB.length);

  for (let i = 0; i < len; i++) {
    const ra = sortedA[i] ?? 999;
    const rb = sortedB[i] ?? 999;
    if (ra !== rb) {
      return {
        diff: ra - rb,
        reason: `Desempate pela ${i + 1}ª melhor colocação (${ra}º vs ${rb}º)`,
      };
    }
  }

  // Persistindo empate absoluto nas colocações, decide pela última prova disputada
  const lastA = ranksA[ranksA.length - 1] ?? 999;
  const lastB = ranksB[ranksB.length - 1] ?? 999;
  if (lastA !== lastB) {
    return {
      diff: lastA - lastB,
      reason: `Desempate pela última prova (${lastA}º vs ${lastB}º)`,
    };
  }

  return { diff: 0 };
}

/**
 * Calcula toda a classificação geral de uma categoria (todos os WODs + soma + desempate oficial).
 */
export function computeCategoryStandings(
  category: Category,
  teams: TeamRegistration[],
  workouts: WorkoutRule[],
  scores: ScoreEntry[],
  pointsTable: number[] = DEFAULT_POINTS_TABLE,
): CategoryStandingResult {
  const categoryTeams = teams.filter((t) => t.categoryId === category.id);
  const categoryWorkouts = sortWorkoutsNaturally(
    workouts.filter((w) => w.categoryId === category.id || w.categoryIds?.includes(category.id)),
  );

  const wodResultsByWorkoutId: Record<string, WorkoutRankRow[]> = {};
  const updatedScores: ScoreEntry[] = [];

  for (const wod of categoryWorkouts) {
    const res = computeWorkoutRanking({ ...wod, categoryId: category.id }, categoryTeams, scores, pointsTable);
    wodResultsByWorkoutId[wod.id] = res.rows;
    updatedScores.push(...res.updatedScores);
  }

  const combined = categoryTeams.map((team) => {
    const workoutScores = categoryWorkouts.map((wod) => {
      const row = wodResultsByWorkoutId[wod.id]?.find((r) => r.team.id === team.id);
      return {
        workoutId: wod.id,
        workoutTitle: wod.title,
        scoreDisplay: row?.displayValue || '-',
        rank: row?.rank || categoryTeams.length || 1,
        points: row?.points || 0,
        timeSeconds: row?.score?.timeSeconds,
        photoSumulaUrl: row?.score?.photoSumulaUrl,
        isApproved: row?.score?.scoreStatus === 'approved_by_head_judge',
        status: row?.score ? (row.score.isWO ? 'wo' : 'scored') : 'none',
      };
    });

    const totalPoints = workoutScores.reduce((acc, w) => acc + w.points, 0);
    const individualRanks = workoutScores.map((w) => (w.status === 'none' ? 999 : w.rank));

    return {
      team,
      workoutScores,
      totalPoints,
      individualRanks,
    };
  });

  combined.sort((a, b) => {
    if (a.team.paymentStatus === 'cancelled' && b.team.paymentStatus !== 'cancelled') return 1;
    if (b.team.paymentStatus === 'cancelled' && a.team.paymentStatus !== 'cancelled') return -1;
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    const tb = compareTiebreak(a.individualRanks, b.individualRanks);
    if (tb.diff !== 0) return tb.diff;
    return a.team.teamName.localeCompare(b.team.teamName);
  });

  const ranks: (LeaderboardRank & { tiebreakNote?: string })[] = combined.map((entry, idx) => {
    let tiebreakNote: string | undefined;
    if (idx > 0 && combined[idx - 1].totalPoints === entry.totalPoints && entry.totalPoints > 0) {
      const tb = compareTiebreak(combined[idx - 1].individualRanks, entry.individualRanks);
      tiebreakNote = tb.reason || 'Empate técnico';
    }
    if (idx < combined.length - 1 && combined[idx + 1].totalPoints === entry.totalPoints && entry.totalPoints > 0) {
      const tb = compareTiebreak(entry.individualRanks, combined[idx + 1].individualRanks);
      tiebreakNote = tb.reason || tiebreakNote;
    }

    return {
      rank: idx + 1,
      registrationId: entry.team.id,
      teamName: entry.team.teamName,
      registerNumber: entry.team.registerNumber,
      categoryName: category.name,
      boxOrAffiliate: entry.team.athletes[0]?.boxOrAffiliate,
      athletes: entry.team.athletes.map((a) => a.name),
      totalPoints: entry.totalPoints,
      totalDisplay: `${entry.totalPoints}`,
      status: entry.team.paymentStatus === 'cancelled' ? 'cancelled' : 'active',
      totalUnit: 'PTS',
      workoutScores: entry.workoutScores,
      tiebreakNote,
    };
  });

  return {
    category,
    workouts: categoryWorkouts,
    ranks,
    wodResultsByWorkoutId,
    updatedScores,
  };
}
