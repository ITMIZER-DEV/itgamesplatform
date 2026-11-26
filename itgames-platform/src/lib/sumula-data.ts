// Carrega da API tudo o que as súmulas precisam: categorias, provas ativas, duplas, layouts e baterias.
import { apiClient } from '@/lib/api-client';
import { mapHeat } from '@/lib/arena-data';
import { DEFAULT_SUMULA_TEMPLATES } from '@/lib/sumula-presets';
import type { Category, Heat, SumulaTemplate, TeamRegistration, WorkoutRule } from '@/types';

export interface SumulaData {
  categories: Category[];
  workouts: WorkoutRule[];
  teams: TeamRegistration[];
  heats: Heat[];
  templates: SumulaTemplate[];
}

const capSeconds = (timeCap?: string | null) => {
  const [m, s] = String(timeCap || '').split(':').map(Number);
  const total = (m || 0) * 60 + (s || 0);
  return total > 0 ? total : 600;
};

export async function loadSumulaData(gameCode: string, gameName?: string): Promise<SumulaData> {
  const [apiCats, apiWods, apiRegs, apiTmpls] = await Promise.all([
    apiClient.listCategories(gameCode),
    apiClient.listWorkouts(gameCode),
    apiClient.listRegistrations(gameCode),
    apiClient.getSumulaTemplates().catch(() => [] as any[]),
  ]);

  const categories = (apiCats || []).map((c: any) => ({
    id: String(c.code),
    gameId: c.gamesId,
    name: c.name,
  })) as unknown as Category[];
  const catName = (id: string) => categories.find((c) => c.id === id)?.name || `Categoria ${id}`;

  const workouts = (apiWods || []).map((w: any) => ({
    id: String(w.code),
    gameId: w.game,
    gameName,
    categoryId: String(w.category),
    categoryIds: [String(w.category)],
    categoryNames: [catName(String(w.category))],
    categoryName: catName(String(w.category)),
    title: w.title || `WOD ${w.code}`,
    type: w.type || 'for_time',
    timeCapSeconds: capSeconds(w.timeCap),
    description: w.description || '',
    sumulaTemplateId: w.sumulaTemplate || undefined,
    movementStandards: [],
    pointsScale: 'standard_100',
  })) as unknown as WorkoutRule[];

  const teams = (apiRegs || []).map((r: any) => ({
    id: `reg_${r.code}`,
    gameId: r.gameCode,
    categoryId: String(r.categoryId),
    categoryName: catName(String(r.categoryId)),
    teamName: r.team,
    registerNumber: r.number || `#${r.code}`,
    paymentStatus: r.status || 'paid',
    athletes: (r.athletes || []).map((a: any) => ({
      id: `ath_${a.code}`,
      name: a.name,
      gender: a.gender || '',
      boxOrAffiliate: a.boxOrGym || undefined,
    })),
  })) as unknown as TeamRegistration[];

  // layouts: os do banco valem sobre os padrões do código
  const byId = new Map<string, SumulaTemplate>(DEFAULT_SUMULA_TEMPLATES.map((t) => [t.id, t]));
  for (const t of apiTmpls || []) byId.set(t.id, t);
  const templates = [...byId.values()];

  const lists = await Promise.all(
    workouts.map((w) =>
      apiClient
        .fetchHeats(gameCode, Number(w.id))
        .then((list) => list.map((h) => mapHeat(h, gameCode)))
        .catch(() => [] as Heat[]),
    ),
  );

  return { categories, workouts, teams, heats: lists.flat(), templates };
}
