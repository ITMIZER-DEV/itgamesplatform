// Motor de classificação: função pura (sem banco, sem Nest) que monta o placar a partir da regra do campeonato.
import { pointsForPosition, resolveRule, ScoringRule } from './rules';
import { Board, BoardRow, BoardWod, EngineInput, EngineScore } from './types';
import { compareWithinWorkout, formatTime, parseTime, WorkoutResult } from './workout-order';

type Workout = EngineInput['workouts'][number];
type Team = EngineInput['teams'][number];

const TOTAL_UNIT = { points_table: 'PTS', rank_sum: 'SOMA', total_time: 'TEMPO' } as const;

function toResult(s: EngineScore, cap: number): WorkoutResult {
  const time = parseTime(s.time);
  return {
    time,
    reps: parseInt(s.reps || '', 10) || 0,
    weight: parseFloat((s.weight || '').replace(',', '.')) || 0,
    tieBreak: parseTime(s.tieBreakTime),
    penalty: s.penaltySeconds || 0,
    completed: time > 0 && (cap === 0 || time <= cap),
  };
}

function display(type: string, r: WorkoutResult): string {
  const total = r.time + r.penalty;
  if (type === 'for_time') return r.completed ? formatTime(total) : `CAP +${r.reps}`;
  // a API não guarda rodadas separadas, só o total de repetições
  if (type === 'amrap') return `${r.reps} reps`;
  if (type === 'max_load' || type === 'complex') return `${r.weight} kg`;
  if (type === 'hyrox_standard' || type === 'hyrox_relay') return formatTime(total);
  return '-';
}

function titleOf(w: Workout): string {
  return w.title || `WOD ${w.code}`;
}

/** Posição e pontos de cada equipe num WOD; `null` quando o WOD não conta. */
function rankWorkout(
  workout: Workout,
  teams: Team[],
  scores: EngineScore[],
  rule: ScoringRule,
): Map<number, BoardWod> | null {
  const type = workout.type || 'for_time';
  const cap = parseTime(workout.timeCap);
  const title = titleOf(workout);

  const valid: { teamCode: number; result: WorkoutResult }[] = [];
  const others: { teamCode: number; status: BoardWod['status']; display: string }[] = [];
  for (const team of teams) {
    const mine = scores.filter((s) => s.teamCode === team.code);
    // havendo mais de um score, vale o último não anulado
    const s = [...mine].reverse().find((x) => !x.voided) ?? mine[mine.length - 1];
    if (team.status === 'cancelled' || s?.voided) {
      others.push({ teamCode: team.code, status: 'cancelled', display: 'CANCELADA' });
    } else if (!s) {
      others.push({ teamCode: team.code, status: 'wo', display: 'Sem Score' });
    } else if (s.isWO) {
      others.push({ teamCode: team.code, status: 'wo', display: 'W.O.' });
    } else {
      valid.push({ teamCode: team.code, result: toResult(s, cap) });
    }
  }
  // sem nenhum resultado válido, o WOD não conta (ninguém ganha 1º por falta de concorrente)
  if (valid.length === 0) return null;

  const pointsOf = (rank: number) => (rule.mode === 'points_table' ? pointsForPosition(rule.pointsTable, rank) : rank);
  valid.sort((a, b) => compareWithinWorkout(type, a.result, b.result));

  const out = new Map<number, BoardWod>();
  let rank = 1;
  valid.forEach((e, i) => {
    // posição densa: empate repete a posição e a seguinte não pula
    if (i > 0 && compareWithinWorkout(type, valid[i - 1].result, e.result) !== 0) rank++;
    out.set(e.teamCode, { title, display: display(type, e.result), rank, points: pointsOf(rank), status: 'scored' });
  });
  const lastPlus1 = rank + 1;
  for (const o of others) {
    out.set(o.teamCode, { title, display: o.display, rank: lastPlus1, points: pointsOf(lastPlus1), status: o.status });
  }
  return out;
}

export function computeBoard(input: EngineInput, now: Date = new Date()): Board {
  const rule = resolveRule(input.game);
  // total_time (HYROX) entra na Task 3
  if (rule.mode === 'total_time') throw new Error('modo não suportado');
  const higherWins = rule.mode === 'points_table';

  const categories = input.categories.map((category) => {
    const workouts = input.workouts.filter((w) => w.category === category.code);
    // ordem por código da equipe: base estável para empates totais
    const teams = input.teams.filter((t) => t.categoryId === category.code).sort((a, b) => a.code - b.code);

    const perWorkout = workouts.map((workout) => {
      if (input.onlyWorkouts && !input.onlyWorkouts.has(workout.code)) return null;
      const scores = input.scores.filter((s) => s.workoutCode === workout.code && s.category === category.code);
      return rankWorkout(workout, teams, scores, rule);
    });
    let lastCounting = -1;
    perWorkout.forEach((m, i) => {
      if (m) lastCounting = i;
    });

    const rows = teams.map((team) => {
      let total = 0;
      let wins = 0;
      const wods: BoardWod[] = workouts.map((workout, i) => {
        const wod = perWorkout[i]?.get(team.code);
        if (!wod) return { title: titleOf(workout), display: 'Sem Score', rank: 0, points: 0, status: 'none' };
        total += wod.points;
        if (wod.rank === 1) wins++;
        return wod;
      });
      return { team, total, wins, lastRank: lastCounting >= 0 ? wods[lastCounting].rank : 0, wods };
    });

    type Row = (typeof rows)[number];
    const compare = (a: Row, b: Row): number => {
      if (a.total !== b.total) return higherWins ? b.total - a.total : a.total - b.total;
      if (rule.tiebreak === 'last_workout') return a.lastRank - b.lastRank;
      if (rule.tiebreak === 'most_wins') return b.wins - a.wins;
      // split:<nome> entra na Task 3; por ora, empate
      return 0;
    };
    rows.sort(compare);

    let rank = 1;
    const boardRows: BoardRow[] = rows.map((r, i) => {
      if (i > 0 && compare(rows[i - 1], r) !== 0) rank++;
      return {
        rank,
        teamCode: r.team.code,
        // cadastros reais trazem espaços sobrando nos nomes
        team: r.team.team.trim(),
        number: (r.team.number || '').trim() || `#${r.team.code}`,
        athletes: r.team.athletes.map((a) => a.trim()).filter(Boolean),
        status: r.team.status,
        totalPoints: r.total,
        totalDisplay: String(r.total),
        wods: r.wods,
      };
    });

    return { id: category.code, name: category.name, wodTitles: workouts.map(titleOf), rows: boardRows };
  });

  return {
    game: {
      code: input.game.code,
      name: input.game.name,
      location: input.game.location || '',
      eventType: input.game.eventType === 'hyrox' ? 'hyrox' : 'crossfit',
      rule: { mode: rule.mode, tiebreak: rule.tiebreak },
      totalUnit: TOTAL_UNIT[rule.mode],
    },
    generatedAt: now.toISOString(),
    categories,
  };
}
