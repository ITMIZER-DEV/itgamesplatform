import { describe, expect, it } from 'vitest';
import { blockOf, buildDayPlan, pickSumulaTemplateId, slotFileName } from '@/lib/sumula-print';

const cat = (id: string, name: string) => ({ id, name }) as any;
const wod = (id: string, categoryId: string, title: string) => ({ id, categoryId, categoryIds: [categoryId], title }) as any;
const team = (code: number, categoryId: string, status = 'paid') =>
  ({ id: `reg_${code}`, categoryId, teamName: `Dupla ${code}`, registerNumber: `#${code}`, paymentStatus: status, athletes: [] }) as any;
const heat = (id: string, workoutId: string, categoryId: string, heatNumber: number, startTime: string, lanes: [number, number][]) =>
  ({ id, workoutId, categoryId, heatNumber, startTime, laneAssignments: lanes.map(([lane, code]) => ({ lane, registrationId: String(code) })) }) as any;

const categories = [cat('2', 'INICIANTE - DUPLA FEMININA'), cat('4', 'SCALED - DUPLA FEMININA')];
const workouts = [
  wod('101', '2', 'WOD 1-A — 800m ROW'), wod('102', '2', 'WOD 1-B — DEATH BY'), wod('104', '2', 'WOD 3 — MAXIMUM LIFT'),
  wod('401', '4', 'WOD 1-A — 1000m ROW'), wod('402', '4', 'WOD 1-B — DEATH BY'), wod('404', '4', 'WOD 3 — MAXIMUM LIFT'),
];
const teams = [team(21, '2'), team(22, '2'), team(23, '2', 'cancelled'), team(41, '4'), team(42, '4')];
const templates = ['crossfit-wod1-combo-iniciante', 'crossfit-wod1-combo-scaled', 'crossfit-wod3-maximum-lift'].map((id) => ({ id }) as any);
const heats = [
  // WOD 1: 1-A e 1-B com as mesmas baterias (súmula combinada, uma só)
  heat('h1', '101', '2', 1, '08:00', [[1, 21], [2, 22], [3, 23]]),
  heat('h2', '102', '2', 1, '08:00', [[1, 21], [2, 22], [3, 23]]),
  heat('h3', '401', '4', 1, '08:26', [[1, 41], [2, 42]]),
  heat('h4', '402', '4', 1, '08:26', [[1, 41], [2, 42]]),
  // WOD 3: bateria mista às 15:05 (Iniciante raias 1-2, Scaled raias 3-4)
  heat('h6', '404', '4', 1, '15:05', [[4, 42], [3, 41]]),
  heat('h5', '104', '2', 1, '15:05', [[1, 21], [2, 22]]),
];

describe('buildDayPlan', () => {
  const plan = buildDayPlan({ categories, workouts, heats, teams, templates });

  it('ordena pelo horário do dia e numera as baterias dentro de cada WOD', () => {
    expect(plan.map((s) => [s.block, s.time, s.number])).toEqual([
      ['1', '08:00', 1],
      ['1', '08:26', 2],
      ['3', '15:05', 1],
    ]);
  });

  it('provas A/B saem numa súmula só por dupla e inscrição cancelada fica de fora', () => {
    expect(plan[0].items.map((i) => [i.lane, i.team.registerNumber, i.workout?.id])).toEqual([
      [1, '#21', '101'],
      [2, '#22', '101'],
    ]);
  });

  it('bateria mista junta as categorias na ordem das raias, cada uma com o seu layout', () => {
    const mixed = plan[2];
    expect(mixed.mixed).toBe(true);
    expect(mixed.categoryNames).toEqual(['INICIANTE - DUPLA FEMININA', 'SCALED - DUPLA FEMININA']);
    expect(mixed.items.map((i) => i.lane)).toEqual([1, 2, 3, 4]);
    expect(mixed.items.map((i) => i.category?.id)).toEqual(['2', '2', '4', '4']);
    expect(new Set(mixed.items.map((i) => i.templateId))).toEqual(new Set(['crossfit-wod3-maximum-lift']));
    expect(plan[1].items[0].templateId).toBe('crossfit-wod1-combo-scaled');
  });

  it('filtra por WOD', () => {
    expect(buildDayPlan({ categories, workouts, heats, teams, templates, blocks: ['3'] }).map((s) => s.block)).toEqual(['3']);
  });
});

describe('auxiliares', () => {
  it('bloco do WOD, layout pela categoria e nome de arquivo seguro', () => {
    expect(blockOf({ id: '9', title: 'WOD 2 — SYNC & BURN' })).toBe('2');
    expect(pickSumulaTemplateId(workouts[0], categories[0], templates)).toBe('crossfit-wod1-combo-iniciante');
    expect(slotFileName({ block: '3', time: '15:05', number: 2, mixed: true, categoryNames: ['INICIANTE - DUPLA FEMININA', 'SCALED - DUPLA FEMININA'], items: [] }))
      .toBe('15h05 - Bateria 2 (mista) - INICIANTE FEMININA + SCALED FEMININA.pdf');
  });
});
