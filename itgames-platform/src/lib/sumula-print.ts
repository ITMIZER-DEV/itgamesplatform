// Montagem das súmulas do dia na ordem da arena (horário → raia), usada pela área de PDFs.
// Funções puras: recebem os dados já carregados e devolvem o que imprimir, em que ordem e com qual layout.

import type { Category, Heat, SumulaTemplate, TeamRegistration, WorkoutRule } from '@/types';
import type { SumulaVariables } from '@/lib/sumula-replacer';

/** "WOD 1-A — ROW" → "1"; provas sem número usam o próprio id. */
export function blockOf(w?: Pick<WorkoutRule, 'title' | 'id'>): string {
  return w?.title?.match(/WOD\s*(\d+)/i)?.[1] ?? w?.id ?? '';
}

/** Layout da súmula: o vinculado à prova; senão o vinculado à categoria/WOD; senão pelo título. */
export function pickSumulaTemplateId(wod: WorkoutRule | undefined, category: Category | undefined, templates: SumulaTemplate[]): string {
  if (wod?.sumulaTemplateId && templates.some((t) => t.id === wod.sumulaTemplateId)) return wod.sumulaTemplateId;
  const bound = templates.find((t) => (wod?.id && t.workoutId === wod.id) || (category?.id && t.categoryId === category.id));
  if (bound) return bound.id;
  const w = (wod?.title || '').toUpperCase();
  const c = (category?.name || '').toUpperCase();
  const tier = c.includes('INICIANTE') ? 'iniciante' : c.includes('SCALED') ? 'scaled' : c.includes('AMADOR') ? 'amador' : '';
  if (/WOD 1|1-A|1-B|ROW|DEATH BY/.test(w)) return tier ? `crossfit-wod1-combo-${tier}` : 'crossfit-wod1-combo-row-deathby';
  if (/WOD 2|SYNC/.test(w)) return tier ? `crossfit-wod2-sync-burn-${tier}` : 'crossfit-wod2-sync-burn';
  if (/WOD 3|MAXIMUM LIFT|CARGA|1RM/.test(w)) return 'crossfit-wod3-maximum-lift';
  return 'crossfit-for-time';
}

export interface PrintItem {
  key: string;
  block: string;
  time: string;
  slotNumber: number; // bateria da arena dentro do WOD (1, 2, 3...)
  heatNumber: number; // bateria da categoria (a que os juízes veem)
  lane: number;
  team: TeamRegistration;
  category?: Category;
  workout?: WorkoutRule;
  templateId: string;
}

export interface PrintSlot {
  block: string;
  time: string;
  number: number;
  categoryNames: string[];
  mixed: boolean;
  items: PrintItem[];
}

const sameTeam = (t: TeamRegistration, regId: string) => t.id === regId || t.id === `reg_${regId}`;

/**
 * Todas as súmulas do dia: um item por dupla em cada WOD (provas A/B do mesmo WOD saem numa súmula só),
 * agrupadas por bateria da arena (mesmo WOD e mesmo horário) e ordenadas por horário e raia.
 */
export function buildDayPlan(input: {
  categories: Category[];
  workouts: WorkoutRule[];
  heats: Heat[];
  teams: TeamRegistration[];
  templates: SumulaTemplate[];
  blocks?: string[]; // limita a esses WODs
}): PrintSlot[] {
  const { categories, workouts, heats, teams, templates } = input;
  // primeira prova (A) de cada WOD em cada categoria
  const primary = new Map<string, WorkoutRule>();
  for (const c of categories) {
    const byBlock = new Map<string, WorkoutRule[]>();
    for (const w of workouts.filter((x) => x.categoryId === c.id || x.categoryIds?.includes(c.id))) {
      byBlock.set(blockOf(w), [...(byBlock.get(blockOf(w)) || []), w]);
    }
    for (const [block, list] of byBlock) {
      if (input.blocks && !input.blocks.includes(block)) continue;
      const first = [...list].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { numeric: true }))[0];
      primary.set(first.id, first);
    }
  }

  const slots = new Map<string, PrintSlot>();
  const sorted = heats
    .filter((h) => primary.has(h.workoutId))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || (a.laneAssignments[0]?.lane ?? 0) - (b.laneAssignments[0]?.lane ?? 0));
  for (const heat of sorted) {
    const workout = primary.get(heat.workoutId)!;
    const block = blockOf(workout);
    const category = categories.find((c) => c.id === heat.categoryId);
    const key = `${block}|${heat.startTime}`;
    let slot = slots.get(key);
    if (!slot) {
      slot = { block, time: heat.startTime, number: 0, categoryNames: [], mixed: false, items: [] };
      slots.set(key, slot);
    }
    if (category && !slot.categoryNames.includes(category.name)) slot.categoryNames.push(category.name);
    const templateId = pickSumulaTemplateId(workout, category, templates);
    for (const lane of [...heat.laneAssignments].sort((a, b) => a.lane - b.lane)) {
      const team = teams.find((t) => sameTeam(t, lane.registrationId) && t.paymentStatus !== 'cancelled');
      if (!team) continue;
      slot.items.push({
        key: `${workout.id}-${heat.id}-${lane.lane}`,
        block,
        time: heat.startTime,
        slotNumber: 0,
        heatNumber: heat.heatNumber,
        lane: lane.lane,
        team,
        category,
        workout,
        templateId,
      });
    }
  }

  // numeração das baterias da arena dentro de cada WOD; ordem final: horário do dia
  const list = [...slots.values()].filter((s) => s.items.length > 0);
  const perBlock = new Map<string, number>();
  for (const s of [...list].sort((a, b) => a.time.localeCompare(b.time))) {
    const n = (perBlock.get(s.block) || 0) + 1;
    perBlock.set(s.block, n);
    s.number = n;
    s.mixed = s.categoryNames.length > 1;
    s.items.sort((a, b) => a.lane - b.lane);
    s.items.forEach((i) => (i.slotNumber = n));
  }
  return list.sort((a, b) => a.time.localeCompare(b.time) || a.block.localeCompare(b.block, 'pt-BR', { numeric: true }));
}

/** Variáveis da súmula de um item (mesmos campos que a tela de súmulas usa). */
export function sumulaVarsFor(item: PrintItem, game: { name?: string; code?: string }, logo: string, originUrl?: string): SumulaVariables {
  const w = item.workout;
  const isWod4 = !!w && /WOD 4|4-A|DOUBLE TROUBLE/.test(w.title);
  return {
    gameName: game.name,
    gameCode: game.code,
    gameLogo: logo,
    categoryName: item.category?.name,
    categoryId: item.category?.id,
    registerNumber: item.team.registerNumber,
    teamName: item.team.teamName,
    athletesList: item.team.athletes.map((a) => a.name).join(' • '),
    athletes: item.team.athletes.map((a) => ({ name: a.name, gender: a.gender })),
    boxAffiliate: item.team.athletes[0]?.boxOrAffiliate || 'Independente',
    eventTitle: w?.title,
    workoutDescription: w?.description,
    timeCap: `${Math.floor((w?.timeCapSeconds || 600) / 60)}:00`,
    tieBreakRule: w?.tieBreakMetric === 'time' ? 'Tempo do Round 2' : 'Repetições válidas',
    heatNumber: item.heatNumber,
    laneNumber: item.lane,
    heatTime: item.time,
    wodCodeA: isWod4 ? 'WOD 4-A' : 'WOD 1-A',
    wodCodeB: isWod4 ? 'WOD 4-B' : 'WOD 1-B',
    originUrl,
  };
}

/** Nome de arquivo seguro: "15:05" → "15h05", sem barras nem caracteres reservados. */
export function safeFileName(s: string): string {
  return s
    .replace(/:/g, 'h')
    .replace(/[\\/*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slotFileName(slot: PrintSlot): string {
  const cats = slot.categoryNames.map((n) => n.replace(/\s*-\s*DUPLA\s*/i, ' ').trim()).join(' + ');
  return safeFileName(`${slot.time} - Bateria ${slot.number}${slot.mixed ? ' (mista)' : ''} - ${cats}.pdf`);
}
