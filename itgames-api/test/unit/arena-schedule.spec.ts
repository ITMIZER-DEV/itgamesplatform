// Planejador de horários: 2 arenas simultâneas (ondas cruzadas) e arena única, sem mexer em duplas/raias.
import { hhmm, planArenaSchedule, PlanHeat, PlanWorkout } from '../../src/modules/heats/arena-schedule';

const categories = [
  { code: 2, name: 'INICIANTE - DUPLA FEMININA' },
  { code: 3, name: 'SCALED - DUPLA MASCULINA' },
  { code: 4, name: 'SCALED - DUPLA FEMININA' },
  { code: 6, name: 'AMADOR - DUPLA MISTA' },
];
const heatsPerCat: Record<number, number> = { 2: 3, 3: 2, 4: 2, 6: 2 };

const workouts: PlanWorkout[] = categories.flatMap(({ code }) => [
  { code: code * 100 + 1, category: code, title: 'WOD 1-A — ROW', timeCap: '05:00', description: 'Min 0 ao 5' },
  { code: code * 100 + 2, category: code, title: 'WOD 1-B — DEATH BY', timeCap: '15:00', description: "Rest 1' + 5 blocos de 3'" },
  { code: code * 100 + 3, category: code, title: 'WOD 2 — SYNC & BURN', timeCap: '10:00', description: '' },
  { code: code * 100 + 4, category: code, title: 'WOD 3 — MAXIMUM LIFT', timeCap: '06:00', description: '' },
  { code: code * 100 + 5, category: code, title: 'WOD 4-A — DOUBLE TROUBLE', timeCap: '04:00', description: '' },
  { code: code * 100 + 6, category: code, title: 'WOD 4-B — DOUBLE TROUBLE', timeCap: '04:00', description: "Após 4' de Rest — AMRAP 4'" },
]);

// Cada categoria: duplas numeradas cat*1000+i; 4 por bateria; WODs com baterias embaralhadas de forma diferente.
const heats: PlanHeat[] = [];
for (const { code } of categories) {
  const teams = Array.from({ length: heatsPerCat[code] * 3 }, (_, i) => code * 1000 + i);
  for (const w of workouts.filter((x) => x.category === code)) {
    // Provas A/B do mesmo WOD têm as mesmas baterias (como o gerador real faz); WODs diferentes, outra ordem.
    const rot = Number(String(w.title).match(/WOD (\d+)/)![1]) % teams.length;
    const order = [...teams.slice(rot), ...teams.slice(0, rot)];
    for (let h = 0; h < heatsPerCat[code]; h++) {
      heats.push({ id: `${w.code}-${h + 1}`, categoryId: code, workoutCode: w.code, heatNumber: h + 1, teams: order.slice(h * 3, h * 3 + 3) });
    }
  }
}

describe('planArenaSchedule — 2 arenas', () => {
  const plan = planArenaSchedule(categories, workouts, heats, {
    arenas: 2,
    startHour: '08:00',
    afternoonStart: '13:00',
    intervalMinutes: 5,
    minRestMinutes: 30,
  });

  it('cobre todas as baterias sem sobreposição em arena nem dupla em dois lugares', () => {
    expect(plan.problems).toEqual([]);
    expect(plan.items.flatMap((i) => i.heatIds).sort()).toEqual(heats.map((h) => h.id).sort());
  });

  it('pares por turno: WOD 1 × WOD 4 de manhã, WOD 2 × WOD 3 à tarde, cada onda passa pelas duas arenas', () => {
    const arenasOf = (label: string) => [...new Set(plan.items.filter((i) => i.blockLabel === label).map((i) => i.arena))];
    expect(arenasOf('WOD 1')).toEqual([1]);
    expect(arenasOf('WOD 4')).toEqual([2]);
    expect(arenasOf('WOD 2')).toEqual([1]);
    expect(arenasOf('WOD 3')).toEqual([2]);
    const morningEnd = Math.max(...plan.items.filter((i) => ['WOD 1', 'WOD 4'].includes(i.blockLabel)).map((i) => i.end));
    const afternoonStart = Math.min(...plan.items.filter((i) => ['WOD 2', 'WOD 3'].includes(i.blockLabel)).map((i) => i.start));
    expect(morningEnd).toBeLessThanOrEqual(13 * 60);
    expect(hhmm(afternoonStart)).toBe('13:00');
  });

  it('bateria A/B dura caps + descanso da descrição (WOD 1 = 21 min, WOD 4 = 12 min)', () => {
    const w1 = plan.items.find((i) => i.blockLabel === 'WOD 1')!;
    const w4 = plan.items.find((i) => i.blockLabel === 'WOD 4')!;
    expect(w1.end - w1.start).toBe(21);
    expect(w4.end - w4.start).toBe(12);
  });

  it('toda dupla descansa pelo menos 30 min entre provas', () => {
    expect(plan.summary.minRestMinutes).toBeGreaterThanOrEqual(30);
  });

  it('o dia termina bem antes da arena única', () => {
    const single = planArenaSchedule(categories, workouts, heats, { arenas: 1, startHour: '08:00', afternoonStart: '13:00', intervalMinutes: 5 });
    expect(single.problems).toEqual([]);
    expect(single.items.every((i) => i.arena === null)).toBe(true);
    expect(plan.summary.totalMinutes).toBeLessThan(single.summary.totalMinutes - 120);
  });
});
