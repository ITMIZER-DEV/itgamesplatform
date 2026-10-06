import { ScoreEntry, WorkoutRule, LeaderboardRank, TeamRegistration } from '@/types';

export const STANDARD_CROSSFIT_POINTS = [
  100, 95, 90, 85, 80, 75, 70, 65, 60, 55,
  50, 47, 44, 41, 38, 35, 32, 29, 26, 23,
  20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 1
];

export function getPointsForRank(rank: number): number {
  if (rank <= 0) return 0;
  if (rank <= STANDARD_CROSSFIT_POINTS.length) {
    return STANDARD_CROSSFIT_POINTS[rank - 1];
  }
  return 1;
}

export function formatSecondsToTime(totalSeconds?: number): string {
  if (totalSeconds === undefined || totalSeconds === null || isNaN(totalSeconds)) return '--:--';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const millis = Math.round((totalSeconds - Math.floor(totalSeconds)) * 10);
  
  const formattedMins = String(mins).padStart(2, '0');
  const formattedSecs = String(secs).padStart(2, '0');
  
  if (millis > 0) {
    return `${formattedMins}:${formattedSecs}.${millis}`;
  }
  return `${formattedMins}:${formattedSecs}`;
}

export function parseTimeToSeconds(timeStr?: string): number {
  if (!timeStr || !timeStr.trim()) return 0;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  }
  return parseFloat(clean) || 0;
}

export function calculateWorkoutRanks(
  workout: WorkoutRule,
  scores: ScoreEntry[]
): ScoreEntry[] {
  const validScores = scores.filter(s => !s.isWO && !s.isDisqualified);
  const invalidScores = scores.filter(s => s.isWO || s.isDisqualified);

  validScores.sort((a, b) => {
    if (workout.type === 'for_time') {
      if (a.isCompleted && !b.isCompleted) return -1;
      if (!a.isCompleted && b.isCompleted) return 1;

      if (a.isCompleted && b.isCompleted) {
        const timeA = (a.timeSeconds || 0) + (a.penaltiesSeconds || 0);
        const timeB = (b.timeSeconds || 0) + (b.penaltiesSeconds || 0);
        if (timeA !== timeB) return timeA - timeB;
        return (a.tieBreakSeconds || 0) - (b.tieBreakSeconds || 0);
      } else {
        const repsA = (a.roundsCount || 0) * 1000 + (a.repsCount || 0);
        const repsB = (b.roundsCount || 0) * 1000 + (b.repsCount || 0);
        if (repsA !== repsB) return repsB - repsA;
        return (a.tieBreakSeconds || 0) - (b.tieBreakSeconds || 0);
      }
    }

    if (workout.type === 'amrap' || workout.type === 'emom') {
      const totalRepsA = (a.roundsCount || 0) * 1000 + (a.repsCount || 0);
      const totalRepsB = (b.roundsCount || 0) * 1000 + (b.repsCount || 0);
      if (totalRepsA !== totalRepsB) return totalRepsB - totalRepsA;
      return (a.tieBreakSeconds || 0) - (b.tieBreakSeconds || 0);
    }

    if (workout.type === 'max_load' || workout.type === 'complex') {
      const loadA = a.weightLoadedKg || 0;
      const loadB = b.weightLoadedKg || 0;
      if (loadA !== loadB) return loadB - loadA;
      return (a.timeSeconds || 0) - (b.timeSeconds || 0);
    }

    if (workout.type === 'hyrox_standard' || workout.type === 'hyrox_relay') {
      const timeA = (a.timeSeconds || 0) + (a.penaltiesSeconds || 0);
      const timeB = (b.timeSeconds || 0) + (b.penaltiesSeconds || 0);
      return timeA - timeB;
    }

    return 0;
  });

  let currentRank = 1;
  const rankedValidScores = validScores.map((score, index) => {
    if (index > 0) {
      const prev = validScores[index - 1];
      const isTied = (score.timeSeconds === prev.timeSeconds) && 
                     (score.repsCount === prev.repsCount) && 
                     (score.weightLoadedKg === prev.weightLoadedKg) &&
                     (score.tieBreakSeconds === prev.tieBreakSeconds);
      if (!isTied) {
        currentRank = index + 1;
      }
    }
    const points = getPointsForRank(currentRank);
    return {
      ...score,
      rankInWorkout: currentRank,
      finalPoints: points
    };
  });

  const rankedInvalidScores = invalidScores.map(score => ({
    ...score,
    rankInWorkout: validScores.length + 1,
    finalPoints: 0
  }));

  return [...rankedValidScores, ...rankedInvalidScores];
}

export function calculateOverallLeaderboard(
  teams: TeamRegistration[],
  workouts: WorkoutRule[],
  allScores: ScoreEntry[],
  isHyroxEvent: boolean = false
): LeaderboardRank[] {
  const ranks: LeaderboardRank[] = teams.map(team => {
    let totalPoints = 0;
    let totalTimeSeconds = 0;

    const workoutScores = workouts.map(workout => {
      const score = allScores.find(
        s => s.registrationId === team.id && s.workoutId === workout.id
      );

      let scoreDisplay = 'Sem Score';
      let rank = 0;
      let points = 0;
      let timeSecs = 0;
      let photoSumulaUrl = undefined;
      let isApproved = false;

      if (score) {
        rank = score.rankInWorkout || 0;
        points = score.finalPoints || 0;
        timeSecs = (score.timeSeconds || 0) + (score.penaltiesSeconds || 0);
        photoSumulaUrl = score.photoSumulaUrl;
        isApproved = score.scoreStatus === 'approved_by_head_judge';

        if (score.isWO) {
          scoreDisplay = 'W.O.';
        } else if (score.isDisqualified) {
          scoreDisplay = 'DESCLASSIFICADO';
        } else if (workout.type === 'for_time') {
          scoreDisplay = score.isCompleted 
            ? `${formatSecondsToTime(timeSecs)}` 
            : `CAP + ${score.repsCount || 0} reps`;
        } else if (workout.type === 'amrap') {
          scoreDisplay = `${score.roundsCount || 0} rds + ${score.repsCount || 0} reps`;
        } else if (workout.type === 'max_load' || workout.type === 'complex') {
          scoreDisplay = `${score.weightLoadedKg || 0} kg`;
        } else if (workout.type === 'hyrox_standard' || workout.type === 'hyrox_relay') {
          scoreDisplay = formatSecondsToTime(timeSecs);
        }

        totalPoints += points;
        totalTimeSeconds += timeSecs;
      }

      return {
        workoutId: workout.id,
        workoutTitle: workout.title,
        scoreDisplay,
        rank,
        points,
        timeSeconds: timeSecs,
        photoSumulaUrl,
        isApproved
      };
    });

    return {
      rank: 0,
      registrationId: team.id,
      teamName: team.teamName,
      registerNumber: team.registerNumber,
      categoryName: team.categoryId,
      boxOrAffiliate: team.athletes[0]?.boxOrAffiliate || 'Independente',
      athletes: team.athletes.map(a => a.name),
      totalPoints,
      totalTimeSeconds,
      workoutScores
    };
  });

  if (isHyroxEvent) {
    ranks.sort((a, b) => (a.totalTimeSeconds || 0) - (b.totalTimeSeconds || 0));
  } else {
    ranks.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      const lastWodA = a.workoutScores[a.workoutScores.length - 1]?.rank || 999;
      const lastWodB = b.workoutScores[b.workoutScores.length - 1]?.rank || 999;
      return lastWodA - lastWodB;
    });
  }

  return ranks.map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));
}
