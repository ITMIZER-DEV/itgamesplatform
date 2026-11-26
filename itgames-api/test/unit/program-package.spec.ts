// Pacote de programação: validação antes de importar WODs, súmulas e timeline em outro sistema.
import { assertProgramShape, planProgramImport, planTemplates, sanitizeProgram, PROGRAM_KIND, ProgramPackage, ProgramTarget } from '../../src/modules/backup/program-package';

const wod = (code: number, category: number, title: string, status = true) => ({
  code, category, title, type: 'for_time', description: '', timeCap: '10:00', foto: null, status,
});

const pkg = (): ProgramPackage => ({
  kind: PROGRAM_KIND,
  version: 1,
  exportedAt: '2026-11-26T10:00:00Z',
  game: { code: 'SUMMER2026', name: 'Summer' },
  categories: [{ code: 2, name: 'INICIANTE - DUPLA FEMININA' }, { code: 4, name: 'SCALED - DUPLA FEMININA' }],
  workouts: [wod(104, 2, 'WOD 3'), wod(404, 4, 'WOD 3'), wod(105, 2, 'WOD 4-A', false)],
  events: [
    { idEvent: 104, workout: 104, category: 2, title: 'WOD 3', description: '', status: true, sumulaTemplate: 'lift' },
    { idEvent: 105, workout: 105, category: 2, title: 'WOD 4-A', description: '', status: false, sumulaTemplate: null },
  ],
  sumulaTemplates: [{ id: 'lift', name: 'Lift', type: 'crossfit', workoutType: 'max_load', gameId: null, categoryId: null, workoutId: null, htmlContent: '<p/>', isDefault: false }],
  heats: [
    // bateria mista às 15:05: Iniciante raias 1-2, Scaled raia 3
    { categoryId: 2, workoutCode: 104, heatNumber: 1, startTime: '15:05', arena: null, slots: [
      { laneNumber: 1, teamCode: 2001, teamName: 'As Frangas', teamNumber: '#2001' },
      { laneNumber: 2, teamCode: 2002, teamName: 'Pink e cérebro ', teamNumber: '#2002' },
    ] },
    { categoryId: 4, workoutCode: 404, heatNumber: 1, startTime: '15:05', arena: null, slots: [
      { laneNumber: 3, teamCode: 4001, teamName: 'Lídia & Paulina', teamNumber: '#4001' },
    ] },
  ],
});

const target = (over: Partial<ProgramTarget> = {}): ProgramTarget => ({
  gameCode: 'SUMMER2026',
  gameExists: true,
  categories: [{ code: 2, name: 'INICIANTE - DUPLA FEMININA' }, { code: 4, name: 'SCALED - DUPLA FEMININA' }],
  registrations: [
    { code: 2001, categoryId: 2, team: 'As Frangas', status: 'paid' },
    { code: 2002, categoryId: 2, team: 'Pink e Cérebro', status: 'paid' },
    { code: 4001, categoryId: 4, team: 'Lidia & Paulina', status: 'paid' },
  ],
  workouts: [wod(104, 2, 'WOD 3'), wod(404, 4, 'WOD 3'), wod(105, 2, 'WOD 4-A', true)],
  events: [
    { idEvent: 104, title: 'WOD 3', sumulaTemplate: 'lift', status: true },
    { idEvent: 105, title: 'WOD 4-A', sumulaTemplate: null, status: true },
  ],
  templates: [],
  heats: [{ status: 'scheduled' }, { status: 'scheduled' }, { status: 'scheduled' }],
  scoreCountByEvent: {},
  officialConfirmed: false,
  ...over,
});

describe('pacote de programação', () => {
  it('rejeita arquivo que não é pacote de programação (ex.: backup completo)', () => {
    expect(() => assertProgramShape({ users: [], scores: [] })).toThrow('não é um pacote');
    expect(() => assertProgramShape({ ...pkg(), version: 9 })).toThrow('Versão');
    expect(() => assertProgramShape(pkg())).not.toThrow();
  });

  it('libera a importação quando categorias e duplas batem (nome com acento/caixa diferente não bloqueia)', () => {
    const r = planProgramImport(pkg(), target());
    expect(r.blockers).toEqual([]);
    expect(r.canApply).toBe(true);
    expect(r.teamIssues).toEqual([]);
    expect(r.summary.workouts).toEqual({ create: 0, update: 1, unchanged: 2 }); // WOD 4-A vira inativo
    expect(r.summary.templates).toEqual({ create: 1, update: 0, skip: 0 });
    expect(r.summary.heats).toMatchObject({ remove: 3, create: 2, lanes: 3, start: '15:05', end: '15:05' });
  });

  it('bloqueia dupla inexistente, cancelada ou de outra categoria no destino', () => {
    const r = planProgramImport(
      pkg(),
      target({
        registrations: [
          { code: 2001, categoryId: 2, team: 'As Frangas', status: 'cancelled' },
          { code: 4001, categoryId: 2, team: 'Lídia & Paulina', status: 'paid' },
        ],
      }),
    );
    expect(r.canApply).toBe(false);
    expect(r.teamIssues.map((t) => [t.teamCode, t.problem])).toEqual([
      [2001, 'Inscrição cancelada neste sistema'],
      [2002, 'Inscrição não existe neste sistema'],
      [4001, 'Está em outra categoria aqui (INICIANTE - DUPLA FEMININA)'],
    ]);
  });

  it('bloqueia campeonato diferente, categoria ausente e resultado oficial confirmado', () => {
    const r = planProgramImport(pkg(), target({ gameCode: 'OUTRO', categories: [{ code: 2, name: 'INICIANTE - DUPLA FEMININA' }], officialConfirmed: true }));
    expect(r.canApply).toBe(false);
    expect(r.blockers.join(' | ')).toMatch(/pacote é do campeonato SUMMER2026/);
    expect(r.blockers.join(' | ')).toMatch(/Categoria 4/);
    expect(r.blockers.join(' | ')).toMatch(/resultado oficial/);
  });

  it('avisa (sem bloquear) prova com score que muda e inscrição ativa fora da timeline', () => {
    const r = planProgramImport(
      pkg(),
      target({
        scoreCountByEvent: { 105: 3 },
        registrations: [...target().registrations, { code: 2003, categoryId: 2, team: 'start box', status: 'paid' }],
      }),
    );
    expect(r.canApply).toBe(true);
    expect(r.warnings.join(' | ')).toMatch(/WOD 4-A .* 3 score/);
    expect(r.warnings.join(' | ')).toMatch(/#2003 start box/);
  });

  it('bloqueia raia repetida na mesma bateria', () => {
    const p = pkg();
    p.heats[0].slots[1].laneNumber = 1;
    const r = planProgramImport(p, target());
    expect(r.canApply).toBe(false);
    expect(r.blockers.join(' ')).toMatch(/Raia 1 repetida/);
  });

  it('descarta campos desconhecidos do arquivo (ex.: "game" de outro campeonato) e confere tipos', () => {
    const raw: any = pkg();
    raw.workouts[0].game = 'OUTRO';
    raw.events[0].game = 'OUTRO';
    raw.sumulaTemplates[0].createdAt = 'x';
    const clean = sanitizeProgram(raw);
    expect(Object.keys(clean.workouts[0]).sort()).toEqual(['category', 'code', 'description', 'foto', 'status', 'timeCap', 'title', 'type']);
    expect('game' in clean.events[0]).toBe(false);
    expect('createdAt' in clean.sumulaTemplates[0]).toBe(false);
    raw.heats[0].slots[0].teamCode = 'abc';
    expect(() => sanitizeProgram(raw)).toThrow('slots.teamCode');
  });

  it('layout de outro campeonato bloqueia; layout global só o Super Admin atualiza; layout novo fica no campeonato', () => {
    const p = pkg();
    p.sumulaTemplates.push({ ...p.sumulaTemplates[0], id: 'global' }, { ...p.sumulaTemplates[0], id: 'alheio' });
    const t = target({ templates: [{ id: 'global', gameId: null }, { id: 'alheio', gameId: 'OUTRO2025' }] });
    const org = planProgramImport(p, t, false);
    expect(org.canApply).toBe(false);
    expect(org.blockers.join(' ')).toMatch(/alheio.*outro campeonato/);
    expect(org.summary.templates).toEqual({ create: 1, update: 0, skip: 1 });
    const tp = planTemplates(p, t, false);
    expect(tp.create.map((x) => [x.id, x.gameId])).toEqual([['lift', 'SUMMER2026']]);
    expect(planTemplates(p, t, true).update.map((x) => [x.id, x.gameId])).toEqual([['global', null]]);
  });
});
