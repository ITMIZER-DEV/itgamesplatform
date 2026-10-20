// Motor de classificação: função pura (sem banco, sem Nest) que monta o placar a partir da regra do campeonato.
import { pointsForPosition, resolveRule, ScoringRule } from './rules';
import { Board, BoardRow, BoardWod, EngineInput, EngineScore, WodEntry } from './types';
import { compareWithinWorkout, formatTime, parseTime, WorkoutResult } from './workout-order';

type Workout = EngineInput['workouts'][number];
type Team = EngineInput['teams'][number];
type Split = { name: string; seconds: number };

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
): Map<number, WodEntry> | null {
  const type = workout.type || 'for_time';
  const cap = parseTime(workout.timeCap);
  const title = titleOf(workout);

  const valid: { teamCode: number; result: WorkoutResult; splits: Split[] }[] = [];
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
      valid.push({ teamCode: team.code, result: toResult(s, cap), splits: s.splits ?? [] });
    }
  }
  // sem nenhum resultado válido, o WOD não conta (ninguém ganha 1º por falta de concorrente)
  if (valid.length === 0) return null;

  const pointsOf = (rank: number) => (rule.mode === 'points_table' ? pointsForPosition(rule.pointsTable, rank) : rank);
  valid.sort((a, b) => compareWithinWorkout(type, a.result, b.result));

  const out = new Map<number, WodEntry>();
  let rank = 1;
  valid.forEach((e, i) => {
    // posição densa: empate repete a posição e a seguinte não pula
    if (i > 0 && compareWithinWorkout(type, valid[i - 1].result, e.result) !== 0) rank++;
    // tempo válido: terminou dentro do cap (quando houver)
    const seconds = e.result.completed ? e.result.time + e.result.penalty : undefined;
    out.set(e.teamCode, {
      title,
      display: display(type, e.result),
      rank,
      points: pointsOf(rank),
      status: 'scored',
      seconds,
      splits: e.splits,
    });
  });
  const lastPlus1 = rank + 1;
  for (const o of others) {
    out.set(o.teamCode, { title, display: o.display, rank: lastPlus1, points: pointsOf(lastPlus1), status: o.status });
  }
  return out;
}

/** Entradas de um WOD numa categoria (chave = código da equipe); `null` quando o WOD não conta. */
export function computeWorkoutEntries(
  input: EngineInput,
  categoryCode: number,
  workoutCode: number,
): Map<number, WodEntry> | null {
  const workout = input.workouts.find((w) => w.code === workoutCode && w.category === categoryCode);
  if (!workout) return null;
  // ordem por código da equipe: base estável para empates totais
  const teams = input.teams.filter((t) => t.categoryId === categoryCode).sort((a, b) => a.code - b.code);
  const scores = input.scores.filter((s) => s.workoutCode === workoutCode && s.category === categoryCode);
  return rankWorkout(workout, teams, scores, resolveRule(input.game));
}

/** Fornece as entradas de um WOD já calculado; `null` deixa o WOD fora do placar. */
export type EntriesProvider = (categoryCode: number, workoutCode: number) => ReadonlyMap<number, WodEntry> | null;

export function computeBoard(input: EngineInput, now: Date = new Date()): Board {
  return buildBoard(
    input,
    (categoryCode, workoutCode) =>
      input.onlyWorkouts && !input.onlyWorkouts.has(workoutCode)
        ? null
        : computeWorkoutEntries(input, categoryCode, workoutCode),
    now,
  );
}

/** Agrega as entradas por WOD em totais, desempate, posição densa e formatos do placar. */
export function buildBoard(input: EngineInput, entries: EntriesProvider, now: Date = new Date()): Board {
  const rule = resolveRule(input.game);
  const timeMode = rule.mode === 'total_time';
  const splitName = rule.tiebreak.startsWith('split:') ? rule.tiebreak.slice('split:'.length) : null;
  const higherWins = rule.mode === 'points_table';

  const categories = input.categories.map((category) => {
    const workouts = input.workouts.filter((w) => w.category === category.code);
    // ordem por código da equipe: base estável para empates totais
    const teams = input.teams.filter((t) => t.categoryId === category.code).sort((a, b) => a.code - b.code);

    const perWorkout = workouts.map((workout) => entries(category.code, workout.code));
    let lastCounting = -1;
    perWorkout.forEach((m, i) => {
      if (m) lastCounting = i;
    });

    const rows = teams.map((team) => {
      let total = 0;
      let wins = 0;
      let seconds = 0;
      let validCount = 0;
      let splitSum = 0;
      let hasSplit = false;
      const wods: BoardWod[] = workouts.map((workout, i) => {
        const wod = perWorkout[i]?.get(team.code);
        if (!wod) return { title: titleOf(workout), display: 'Sem Score', rank: 0, points: 0, status: 'none' };
        total += wod.points;
        if (wod.rank === 1) wins++;
        if (wod.seconds !== undefined) {
          seconds += wod.seconds;
          validCount++;
        }
        // parciais só dos WODs que contam para a equipe: com tempo válido (total_time) ou pontuados (demais modos)
        const countsForSplit = timeMode ? wod.seconds !== undefined : wod.status === 'scored';
        if (countsForSplit) {
          const found = (wod.splits ?? []).filter((sp) => sp.name === splitName);
          if (found.length > 0) {
            hasSplit = true;
            splitSum += found.reduce((acc, sp) => acc + sp.seconds, 0);
          }
        }
        // só título, texto, posição, pontos e status vão para o placar
        return { title: wod.title, display: wod.display, rank: wod.rank, points: wod.points, status: wod.status };
      });
      // terminou = tem tempo válido em todos os WODs que contam
      const countingWods = perWorkout.filter(Boolean).length;
      const finished = timeMode && countingWods > 0 && validCount === countingWods;
      return {
        team, total, wins, seconds, validCount, finished, splitSum, hasSplit,
        lastRank: lastCounting >= 0 ? wods[lastCounting].rank : 0,
        wods,
      };
    });

    type Row = (typeof rows)[number];
    // desempate: vale em todos os modos, só entre equipes com o mesmo total
    const tiebreakCompare = (a: Row, b: Row): number => {
      if (splitName !== null) {
        // parcial menor vence; quem não tem o parcial perde; ninguém tem => empate
        if (a.hasSplit !== b.hasSplit) return a.hasSplit ? -1 : 1;
        return a.splitSum - b.splitSum;
      }
      if (rule.tiebreak === 'last_workout') return a.lastRank - b.lastRank;
      if (rule.tiebreak === 'most_wins') return b.wins - a.wins;
      return 0;
    };
    const compare = (a: Row, b: Row): number => {
      if (timeMode) {
        // quem terminou vem primeiro; as demais por WODs válidos (mais primeiro)
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (!a.finished) return b.validCount - a.validCount;
        if (a.seconds !== b.seconds) return a.seconds - b.seconds;
        return tiebreakCompare(a, b);
      }
      if (a.total !== b.total) return higherWins ? b.total - a.total : a.total - b.total;
      return tiebreakCompare(a, b);
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
        totalPoints: timeMode ? (r.finished ? r.seconds : 0) : r.total,
        totalDisplay: timeMode ? (r.finished ? formatTime(r.seconds) : '—') : String(r.total),
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
