// Planejamento de horários das baterias JÁ montadas (duplas e raias não mudam), em 1 arena ou 2 arenas simultâneas.
// Função pura: recebe categorias, WODs e baterias e devolve horário/arena de cada bateria + conferências.
//
// 2 arenas (ondas cruzadas):
//   - As categorias são divididas em duas ondas com número de baterias equilibrado.
//   - Os WODs viram pares por turno: 1º com o último, 2º com o penúltimo... (Summer: WOD 1 × WOD 4, WOD 2 × WOD 3).
//   - Rodada A: onda 1 na Arena 1 (WOD do par) e onda 2 na Arena 2 (outro WOD). Rodada B: as ondas trocam de arena.
//   - A rodada B só começa quando toda dupla teve pelo menos `minRestMinutes` de descanso.
// 1 arena: WODs em ordem, todas as categorias em cada WOD.
// Em ambos: tempo da bateria = time caps + descanso entre provas A/B (lido da descrição) e almoço até `afternoonStart`.
import { categoryArenaOrder, extractWodBlockKey, parseRestMinutes, parseTimeCapMinutes } from './heat-time';

export interface PlanCategory {
  code: number;
  name: string | null;
}
export interface PlanWorkout {
  code: number;
  category: number;
  title: string | null;
  timeCap: string | null;
  description: string | null;
}
export interface PlanHeat {
  id: string;
  categoryId: number;
  workoutCode: number;
  heatNumber: number;
  teams: number[];
}
export interface PlanOptions {
  arenas: 1 | 2;
  startHour?: string; // "08:00"
  /** Troca entre baterias (min). Número único ou por bloco ("block_1": 4...). Padrão 5. */
  intervalMinutes?: number | Record<string, number>;
  /** Início do turno da tarde ("13:00"); vazio = sem pausa de almoço. */
  afternoonStart?: string;
  /** Descanso mínimo de uma dupla entre duas provas (2 arenas). Padrão 30. */
  minRestMinutes?: number;
  /** Transição entre WODs na arena única. Padrão 5. */
  wodTransitionMinutes?: number;
}
export interface PlannedHeat {
  heatIds: string[];
  categoryId: number;
  categoryName: string;
  block: string;
  blockLabel: string;
  heatNumber: number;
  start: number; // minutos desde 00:00
  end: number;
  arena: number | null;
  teams: number[];
}
export interface PlanResult {
  items: PlannedHeat[];
  problems: string[];
  summary: {
    arenas: 1 | 2;
    start: string;
    end: string;
    totalMinutes: number;
    heatsPerArena: Record<string, number>;
    busyMinutesPerArena: Record<string, number>;
    minRestMinutes: number | null;
    avgRestMinutes: number | null;
    minRestInfo: string;
  };
}

export const hhmm = (m: number) => {
  const n = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
};
const toMin = (s?: string) => {
  const m = String(s || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const ceil5 = (m: number) => Math.ceil(m / 5) * 5;
const blockNumber = (key: string) => {
  const m = key.match(/^block_(\d+)/);
  return m ? Number(m[1]) : 1000;
};

export function planArenaSchedule(
  categoriesIn: PlanCategory[],
  workouts: PlanWorkout[],
  heats: PlanHeat[],
  opts: PlanOptions,
): PlanResult {
  const arenas = opts.arenas === 2 ? 2 : 1;
  const startMin = Number.isFinite(toMin(opts.startHour)) ? toMin(opts.startHour) : 8 * 60;
  const afternoon = toMin(opts.afternoonStart);
  const minRest = opts.minRestMinutes ?? 30;
  const wodTransition = opts.wodTransitionMinutes ?? 5;
  const interval = (block: string) =>
    typeof opts.intervalMinutes === 'number'
      ? opts.intervalMinutes
      : (opts.intervalMinutes?.[block] ?? 5);

  const categories = [...categoriesIn].sort(
    (a, b) => categoryArenaOrder(a.name, a.code) - categoryArenaOrder(b.name, b.code),
  );
  const catName = new Map(categories.map((c) => [c.code, c.name || `Categoria ${c.code}`]));
  const wodByCode = new Map(workouts.map((w) => [`${w.category}:${w.code}`, w]));

  // Grupos: categoria × bloco (WOD 1 = 1-A + 1-B) × número da bateria
  type Group = Omit<PlannedHeat, 'start' | 'end' | 'arena'> & { work: number };
  const groups = new Map<string, Group[]>(); // chave "cat|block"
  const blocksSet = new Set<string>();
  const workCache = new Map<string, number>();
  const blockWork = (catId: number, block: string) => {
    const key = `${catId}|${block}`;
    if (!workCache.has(key)) {
      const wods = workouts
        .filter((w) => w.category === catId && extractWodBlockKey(w.title, w.code) === block)
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR', { numeric: true }));
      let work = 0;
      wods.forEach((w, i) => {
        work += parseTimeCapMinutes(w.timeCap, 10);
        if (i > 0) work += parseRestMinutes(w.description, 1);
      });
      workCache.set(key, work || 10);
    }
    return workCache.get(key)!;
  };
  for (const h of heats) {
    const w = wodByCode.get(`${h.categoryId}:${h.workoutCode}`);
    const block = extractWodBlockKey(w?.title, h.workoutCode);
    blocksSet.add(block);
    const key = `${h.categoryId}|${block}`;
    const list = groups.get(key) || [];
    let g = list.find((x) => x.heatNumber === h.heatNumber);
    if (!g) {
      const n = blockNumber(block);
      g = {
        heatIds: [],
        categoryId: h.categoryId,
        categoryName: catName.get(h.categoryId) || `Categoria ${h.categoryId}`,
        block,
        blockLabel: n < 1000 ? `WOD ${n}` : String(w?.title || block),
        heatNumber: h.heatNumber,
        teams: [],
        work: blockWork(h.categoryId, block),
      };
      list.push(g);
      groups.set(key, list);
    }
    g.heatIds.push(h.id);
    for (const t of h.teams) if (!g.teams.includes(t)) g.teams.push(t);
  }
  groups.forEach((l) => l.sort((a, b) => a.heatNumber - b.heatNumber));
  const blocks = [...blocksSet].sort((a, b) => blockNumber(a) - blockNumber(b) || a.localeCompare(b));

  const items: PlannedHeat[] = [];
  const place = (cats: PlanCategory[], block: string, arena: number | null, cursor: number) => {
    const placed: PlannedHeat[] = [];
    for (const c of cats) {
      for (const g of groups.get(`${c.code}|${block}`) || []) {
        const { work, ...rest } = g;
        placed.push({ ...rest, start: cursor, end: cursor + work, arena });
        cursor += work + interval(block);
      }
    }
    return { placed, cursor };
  };
  let lunched = false;
  const nextPhaseStart = (prevEnd: number) => {
    if (!lunched && Number.isFinite(afternoon) && prevEnd >= afternoon - 150) {
      lunched = true;
      return ceil5(Math.max(afternoon, prevEnd + 30));
    }
    return ceil5(prevEnd + wodTransition);
  };

  if (arenas === 1) {
    let cursor = startMin;
    blocks.forEach((block, i) => {
      if (i > 0) cursor = nextPhaseStart(cursor - interval(blocks[i - 1]));
      const r = place(categories, block, null, cursor);
      items.push(...r.placed);
      cursor = r.cursor;
    });
  } else {
    // Ondas: corte contínuo na ordem das categorias que mais equilibra o nº de baterias
    const heatCount = (c: PlanCategory) =>
      Math.max(0, ...blocks.map((b) => (groups.get(`${c.code}|${b}`) || []).length));
    const withHeats = categories.filter((c) => heatCount(c) > 0);
    let cut = 1;
    let best = Infinity;
    for (let k = 1; k < withHeats.length; k++) {
      const a = withHeats.slice(0, k).reduce((x, c) => x + heatCount(c), 0);
      const b = withHeats.slice(k).reduce((x, c) => x + heatCount(c), 0);
      if (Math.abs(a - b) < best) {
        best = Math.abs(a - b);
        cut = k;
      }
    }
    const waves = [withHeats.slice(0, cut), withHeats.slice(cut)];

    // Pares de WOD por turno: primeiro com último, segundo com penúltimo...
    const phases: [string, string][] = [];
    for (let i = 0, j = blocks.length - 1; i <= j; i++, j--) phases.push([blocks[i], blocks[j]]);

    const restOk = (candidate: PlannedHeat[]) => {
      for (const it of candidate) {
        for (const t of it.teams) {
          for (const prev of items) {
            if (!prev.teams.includes(t)) continue;
            const gap = it.start >= prev.end ? it.start - prev.end : prev.start >= it.end ? prev.start - it.end : -1;
            if (gap < minRest) return false;
          }
        }
      }
      return true;
    };

    let phaseStart = startMin;
    phases.forEach(([b1, b2], idx) => {
      if (idx > 0) {
        const prevEnd = Math.max(...items.map((i) => i.end));
        phaseStart = nextPhaseStart(prevEnd);
      }
      const roundA1 = place(waves[0], b1, 1, phaseStart);
      const roundA2 = place(waves[1], b2, 2, phaseStart);
      items.push(...roundA1.placed, ...roundA2.placed);
      // Rodada B: inverte as ondas; espera o descanso mínimo de todas as duplas
      let s = ceil5(Math.max(roundA1.cursor, roundA2.cursor));
      for (let guard = 0; guard < 200; guard++, s += 5) {
        const c1 = place(waves[1], b1, 1, s).placed;
        const c2 = place(waves[0], b2, 2, s).placed;
        if (restOk([...c1, ...c2])) {
          items.push(...c1, ...c2);
          break;
        }
      }
    });
  }

  // ── Conferências
  const problems: string[] = [];
  const covered = new Set(items.flatMap((i) => i.heatIds));
  const missing = heats.filter((h) => !covered.has(h.id));
  if (missing.length) {
    problems.push(`${missing.length} bateria(s) sem horário: ${missing.map((h) => `cat ${h.categoryId} WOD ${h.workoutCode} B${h.heatNumber}`).join(', ')}`);
  }
  const arenaKeys = arenas === 2 ? [1, 2] : [null];
  for (const a of arenaKeys) {
    const list = items.filter((i) => i.arena === a).sort((x, y) => x.start - y.start);
    for (let k = 1; k < list.length; k++) {
      if (list[k].start < list[k - 1].end) {
        problems.push(`${a ? `Arena ${a}` : 'Arena'}: bateria das ${hhmm(list[k].start)} começa antes da anterior terminar`);
      }
    }
  }
  const byTeam = new Map<number, PlannedHeat[]>();
  items.forEach((i) => i.teams.forEach((t) => byTeam.set(t, [...(byTeam.get(t) || []), i])));
  const rests: number[] = [];
  let minRestInfo = '';
  let minSeen = Infinity;
  for (const [team, list] of byTeam) {
    const s = [...list].sort((a, b) => a.start - b.start);
    for (let k = 1; k < s.length; k++) {
      const gap = s[k].start - s[k - 1].end;
      if (gap < 0) problems.push(`Dupla ${team} em duas baterias ao mesmo tempo (${hhmm(s[k].start)})`);
      rests.push(gap);
      if (gap < minSeen) {
        minSeen = gap;
        minRestInfo = `dupla ${team} (${s[k - 1].categoryName}): ${hhmm(s[k - 1].end)} → ${hhmm(s[k].start)}`;
      }
    }
  }

  const first = items.length ? Math.min(...items.map((i) => i.start)) : startMin;
  const last = items.length ? Math.max(...items.map((i) => i.end)) : startMin;
  const heatsPerArena: Record<string, number> = {};
  const busy: Record<string, number> = {};
  for (const i of items) {
    const k = i.arena ? `Arena ${i.arena}` : 'Arena única';
    heatsPerArena[k] = (heatsPerArena[k] || 0) + 1;
    busy[k] = (busy[k] || 0) + (i.end - i.start);
  }
  items.sort((a, b) => a.start - b.start || (a.arena ?? 0) - (b.arena ?? 0));
  return {
    items,
    problems,
    summary: {
      arenas,
      start: hhmm(first),
      end: hhmm(last),
      totalMinutes: last - first,
      heatsPerArena,
      busyMinutesPerArena: busy,
      minRestMinutes: rests.length ? Math.min(...rests) : null,
      avgRestMinutes: rests.length ? Math.round(rests.reduce((x, y) => x + y, 0) / rests.length) : null,
      minRestInfo,
    },
  };
}
