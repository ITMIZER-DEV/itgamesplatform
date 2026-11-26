// Pacote de programação de um campeonato: WODs, provas, layouts de súmula e timeline (baterias).
// Não leva scores, resultados oficiais, inscrições nem usuários. A validação aqui é pura (testável)
// e decide se a importação pode ser gravada.

export const PROGRAM_KIND = 'itgames-program';
export const PROGRAM_VERSION = 1;

export interface ProgramWorkout {
  code: number;
  category: number;
  title: string | null;
  type: string | null;
  description: string | null;
  timeCap: string | null;
  foto: string | null;
  status: boolean | null;
}

export interface ProgramEvent {
  idEvent: number;
  workout: number | null;
  category: number;
  title: string;
  description: string | null;
  status: boolean | null;
  sumulaTemplate: string | null;
}

export interface ProgramTemplate {
  id: string;
  name: string;
  type: string;
  workoutType: string;
  gameId: string | null;
  categoryId: string | null;
  workoutId: string | null;
  htmlContent: string;
  isDefault: boolean;
}

export interface ProgramSlot {
  laneNumber: number;
  teamCode: number;
  teamName: string;
  teamNumber: string | null;
}

export interface ProgramHeat {
  categoryId: number;
  workoutCode: number;
  heatNumber: number;
  startTime: string;
  arena: number | null;
  slots: ProgramSlot[];
}

export interface ProgramPackage {
  kind: typeof PROGRAM_KIND;
  version: number;
  exportedAt: string;
  game: { code: string; name: string };
  categories: { code: number; name: string }[];
  workouts: ProgramWorkout[];
  events: ProgramEvent[];
  sumulaTemplates: ProgramTemplate[];
  heats: ProgramHeat[];
}

// Estado atual do campeonato no sistema de destino (o que a validação precisa saber)
export interface ProgramTarget {
  gameCode: string;
  gameExists: boolean;
  categories: { code: number; name: string }[];
  registrations: { code: number; categoryId: number; team: string; status: string | null }[];
  workouts: ProgramWorkout[];
  events: { idEvent: number; title: string; sumulaTemplate: string | null; status: boolean | null }[];
  templates: { id: string; gameId: string | null }[];
  heats: { status: string }[];
  scoreCountByEvent: Record<number, number>;
  officialConfirmed: boolean;
}

export interface ProgramReport {
  canApply: boolean;
  blockers: string[];
  warnings: string[];
  summary: {
    workouts: { create: number; update: number; unchanged: number };
    events: { create: number; update: number; unchanged: number };
    templates: { create: number; update: number; skip: number };
    heats: { remove: number; create: number; lanes: number; start: string | null; end: string | null };
  };
  teamIssues: { teamCode: number; teamName: string; category: string; problem: string }[];
}

const norm = (s?: string | null) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

const workoutChanged = (a: ProgramWorkout, b: ProgramWorkout) =>
  (['title', 'type', 'description', 'timeCap', 'foto', 'status', 'category'] as const).some(
    (k) => (a[k] ?? null) !== (b[k] ?? null),
  );

// Monta o pacote só com os campos conhecidos e tipos certos (nada do arquivo vai direto ao banco)
const num = (v: any, field: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`Campo "${field}" inválido.`);
  return n;
};
const optNum = (v: any, field: string): number | null => (v === null || v === undefined ? null : num(v, field));
const str = (v: any, field: string): string => {
  if (typeof v !== 'string') throw new Error(`Campo "${field}" inválido.`);
  return v;
};
const optStr = (v: any): string | null => (typeof v === 'string' ? v : null);
const optBool = (v: any): boolean | null => (typeof v === 'boolean' ? v : null);

export function sanitizeProgram(raw: any): ProgramPackage {
  assertProgramShape(raw);
  return {
    kind: PROGRAM_KIND,
    version: PROGRAM_VERSION,
    exportedAt: optStr(raw.exportedAt) ?? '',
    game: { code: str(raw.game.code, 'game.code'), name: optStr(raw.game.name) ?? '' },
    categories: raw.categories.map((c: any) => ({ code: num(c.code, 'categories.code'), name: optStr(c.name) ?? '' })),
    workouts: raw.workouts.map((w: any) => ({
      code: num(w.code, 'workouts.code'),
      category: num(w.category, 'workouts.category'),
      title: optStr(w.title),
      type: optStr(w.type),
      description: optStr(w.description),
      timeCap: optStr(w.timeCap),
      foto: optStr(w.foto),
      status: optBool(w.status),
    })),
    events: raw.events.map((e: any) => ({
      idEvent: num(e.idEvent, 'events.idEvent'),
      workout: optNum(e.workout, 'events.workout'),
      category: num(e.category, 'events.category'),
      title: str(e.title, 'events.title'),
      description: optStr(e.description),
      status: optBool(e.status),
      sumulaTemplate: optStr(e.sumulaTemplate),
    })),
    sumulaTemplates: raw.sumulaTemplates.map((t: any) => ({
      id: str(t.id, 'sumulaTemplates.id'),
      name: str(t.name, 'sumulaTemplates.name'),
      type: optStr(t.type) ?? 'crossfit',
      workoutType: optStr(t.workoutType) ?? 'for_time',
      gameId: optStr(t.gameId),
      categoryId: optStr(t.categoryId),
      workoutId: optStr(t.workoutId),
      htmlContent: str(t.htmlContent, 'sumulaTemplates.htmlContent'),
      isDefault: optBool(t.isDefault) ?? false,
    })),
    heats: raw.heats.map((h: any) => {
      if (!Array.isArray(h.slots)) throw new Error('Bateria sem a lista de raias.');
      return {
        categoryId: num(h.categoryId, 'heats.categoryId'),
        workoutCode: num(h.workoutCode, 'heats.workoutCode'),
        heatNumber: num(h.heatNumber, 'heats.heatNumber'),
        startTime: str(h.startTime, 'heats.startTime'),
        arena: optNum(h.arena, 'heats.arena'),
        slots: h.slots.map((s: any) => ({
          laneNumber: num(s.laneNumber, 'slots.laneNumber'),
          teamCode: num(s.teamCode, 'slots.teamCode'),
          teamName: optStr(s.teamName) ?? '',
          teamNumber: optStr(s.teamNumber),
        })),
      };
    }),
  };
}

// Layouts de súmula: o que pode ser gravado. Layout de outro campeonato nunca é tocado;
// layout global (sem campeonato) só o Super Admin atualiza. Layout novo fica ligado a este campeonato.
export function planTemplates(pkg: ProgramPackage, target: ProgramTarget, isSuperAdmin: boolean) {
  const existing = new Map(target.templates.map((t) => [t.id, t]));
  const create: ProgramTemplate[] = [];
  const update: ProgramTemplate[] = [];
  const skip: ProgramTemplate[] = [];
  const foreign: ProgramTemplate[] = [];
  for (const t of pkg.sumulaTemplates) {
    const cur = existing.get(t.id);
    const gameId = t.gameId === null && isSuperAdmin ? null : target.gameCode;
    if (!cur) create.push({ ...t, gameId });
    else if (cur.gameId && cur.gameId !== target.gameCode) foreign.push(t);
    else if (!cur.gameId && !isSuperAdmin) skip.push(t);
    else update.push({ ...t, gameId: cur.gameId });
  }
  return { create, update, skip, foreign };
}

// Confere a estrutura mínima do arquivo antes de qualquer outra coisa
export function assertProgramShape(pkg: any): asserts pkg is ProgramPackage {
  if (!pkg || typeof pkg !== 'object' || pkg.kind !== PROGRAM_KIND) {
    throw new Error('Arquivo não é um pacote de programação do ITGames.');
  }
  if (pkg.version !== PROGRAM_VERSION) {
    throw new Error(`Versão do pacote (${pkg.version}) diferente da suportada (${PROGRAM_VERSION}).`);
  }
  for (const key of ['categories', 'workouts', 'events', 'sumulaTemplates', 'heats']) {
    if (!Array.isArray(pkg[key])) throw new Error(`Pacote sem a lista "${key}".`);
  }
  if (!pkg.game?.code) throw new Error('Pacote sem o código do campeonato.');
}

export function planProgramImport(pkg: ProgramPackage, target: ProgramTarget, isSuperAdmin = false): ProgramReport {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const teamIssues: ProgramReport['teamIssues'] = [];

  if (!target.gameExists) blockers.push(`O campeonato ${target.gameCode} não existe neste sistema.`);
  if (pkg.game.code !== target.gameCode) {
    blockers.push(`O pacote é do campeonato ${pkg.game.code}, não de ${target.gameCode}.`);
  }
  if (target.officialConfirmed) {
    blockers.push('Há resultado oficial confirmado neste campeonato. Reverta o cálculo oficial antes de importar.');
  }

  // Categorias: precisam existir no destino (o pacote não cria categorias)
  const targetCats = new Map(target.categories.map((c) => [c.code, c]));
  const catName = (code: number) => targetCats.get(code)?.name ?? pkg.categories.find((c) => c.code === code)?.name ?? `Categoria ${code}`;
  for (const c of pkg.categories) {
    const t = targetCats.get(c.code);
    if (!t) blockers.push(`Categoria ${c.code} (${c.name}) não existe neste sistema.`);
    else if (norm(t.name) !== norm(c.name)) warnings.push(`Categoria ${c.code} tem outro nome aqui: "${t.name}" (pacote: "${c.name}").`);
  }

  // WODs e provas
  const targetWods = new Map(target.workouts.map((w) => [`${w.code}`, w]));
  const wodSummary = { create: 0, update: 0, unchanged: 0 };
  const changedWods = new Set<number>();
  for (const w of pkg.workouts) {
    const cur = targetWods.get(`${w.code}`);
    if (!cur) wodSummary.create++;
    else if (workoutChanged(w, cur)) {
      wodSummary.update++;
      changedWods.add(w.code);
    } else wodSummary.unchanged++;
  }
  const pkgWodCodes = new Set(pkg.workouts.map((w) => w.code));
  const extra = target.workouts.filter((w) => !pkgWodCodes.has(w.code) && w.status !== false);
  if (extra.length) {
    warnings.push(`${extra.length} WOD(s) ativos aqui não estão no pacote e ficam como estão: ${extra.map((w) => w.title ?? w.code).join(', ')}.`);
  }

  const targetEvents = new Map(target.events.map((e) => [e.idEvent, e]));
  const evSummary = { create: 0, update: 0, unchanged: 0 };
  for (const e of pkg.events) {
    const cur = targetEvents.get(e.idEvent);
    if (!cur) evSummary.create++;
    else if (cur.title !== e.title || (cur.sumulaTemplate ?? null) !== (e.sumulaTemplate ?? null) || (cur.status ?? null) !== (e.status ?? null)) evSummary.update++;
    else evSummary.unchanged++;
    const scored = target.scoreCountByEvent[e.idEvent] ?? 0;
    const wodChanged = changedWods.has(e.workout ?? e.idEvent);
    if (scored > 0 && (wodChanged || (cur && cur.status !== e.status))) {
      warnings.push(`${e.title} (${catName(e.category)}) já tem ${scored} score(s) aqui e a prova será alterada.`);
    }
  }

  // Layouts de súmula
  const tp = planTemplates(pkg, target, isSuperAdmin);
  const tmplSummary = { create: tp.create.length, update: tp.update.length, skip: tp.skip.length };
  for (const t of tp.foreign) blockers.push(`Layout de súmula "${t.name}" (${t.id}) pertence a outro campeonato neste sistema.`);
  if (tp.skip.length) {
    warnings.push(`${tp.skip.length} layout(s) global(is) já existem aqui e ficam como estão (só o Super Admin atualiza): ${tp.skip.map((t) => t.id).join(', ')}.`);
  }
  const tmplIds = new Set([...target.templates.map((t) => t.id), ...pkg.sumulaTemplates.map((t) => t.id)]);
  for (const e of pkg.events) {
    if (e.sumulaTemplate && !tmplIds.has(e.sumulaTemplate)) {
      warnings.push(`${e.title}: layout de súmula "${e.sumulaTemplate}" não existe no pacote nem aqui.`);
    }
  }

  // Timeline: cada bateria aponta para WOD do pacote; cada dupla precisa existir aqui, na mesma categoria
  const regs = new Map(target.registrations.map((r) => [r.code, r]));
  const seen = new Set<number>();
  let lanes = 0;
  const allWodCodes = new Set([...pkgWodCodes, ...target.workouts.map((w) => w.code)]);
  for (const h of pkg.heats) {
    if (!allWodCodes.has(h.workoutCode)) blockers.push(`Bateria ${h.heatNumber} (${catName(h.categoryId)}) aponta para o WOD ${h.workoutCode}, que não existe.`);
    const lanesUsed = new Set<number>();
    for (const s of h.slots) {
      lanes++;
      if (lanesUsed.has(s.laneNumber)) blockers.push(`Raia ${s.laneNumber} repetida na bateria ${h.heatNumber} de ${catName(h.categoryId)} (${h.startTime}).`);
      lanesUsed.add(s.laneNumber);
      if (seen.has(s.teamCode * 100000 + h.workoutCode)) continue;
      seen.add(s.teamCode * 100000 + h.workoutCode);
      const r = regs.get(s.teamCode);
      const issue = (problem: string) => {
        if (!teamIssues.some((t) => t.teamCode === s.teamCode && t.problem === problem)) {
          teamIssues.push({ teamCode: s.teamCode, teamName: s.teamName, category: catName(h.categoryId), problem });
        }
      };
      if (!r) issue('Inscrição não existe neste sistema');
      else if (r.categoryId !== h.categoryId) issue(`Está em outra categoria aqui (${catName(r.categoryId)})`);
      else if (r.status === 'cancelled') issue('Inscrição cancelada neste sistema');
      else if (norm(r.team) !== norm(s.teamName)) warnings.push(`Dupla #${s.teamCode} tem outro nome aqui: "${r.team.trim()}" (pacote: "${s.teamName.trim()}").`);
    }
  }
  if (teamIssues.length) blockers.push(`${teamIssues.length} dupla(s) da timeline não batem com as inscrições deste sistema.`);

  // Duplas ativas aqui que não aparecem na timeline
  const inTimeline = new Set(pkg.heats.flatMap((h) => h.slots.map((s) => s.teamCode)));
  const missing = target.registrations.filter((r) => r.status !== 'cancelled' && !inTimeline.has(r.code));
  if (pkg.heats.length && missing.length) {
    warnings.push(`${missing.length} inscrição(ões) ativa(s) aqui ficam fora da timeline: ${missing.map((r) => `#${r.code} ${r.team.trim()}`).join(', ')}.`);
  }

  const running = target.heats.filter((h) => h.status !== 'scheduled').length;
  if (running) warnings.push(`${running} bateria(s) daqui já foram chamadas/iniciadas e serão substituídas.`);

  const times = pkg.heats.map((h) => h.startTime).filter(Boolean).sort();
  return {
    canApply: blockers.length === 0,
    blockers,
    warnings,
    summary: {
      workouts: wodSummary,
      events: evSummary,
      templates: tmplSummary,
      heats: { remove: target.heats.length, create: pkg.heats.length, lanes, start: times[0] ?? null, end: times[times.length - 1] ?? null },
    },
    teamIssues,
  };
}
