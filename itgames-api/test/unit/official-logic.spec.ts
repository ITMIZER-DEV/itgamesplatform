import {
  officialKey,
  evaluateReadiness,
  officialState,
  parseRevertReason,
} from '../../src/modules/official/official-logic';

const done = (n: number) => ({ heatNumber: n, status: 'completed' });

describe('officialKey', () => {
  it('monta a chave game:categoria:evento', () => {
    expect(officialKey('G1', 1, 10)).toBe('G1:1:10');
  });
});

describe('evaluateReadiness', () => {
  it('bloqueia com baterias não encerradas e cita os números', () => {
    const r = evaluateReadiness({
      hasWorkoutLink: true,
      heats: [done(1), { heatNumber: 2, status: 'in_progress' }, { heatNumber: 3, status: 'scheduled' }],
      scoreStatuses: ['validated'],
      validResults: 1,
    });
    expect(r.canConfirm).toBe(false);
    expect(r.heats).toEqual({ total: 3, completed: 1, pending: [2, 3] });
    expect(r.blockers.some((b) => b.includes('2, 3'))).toBe(true);
  });

  it('bloqueia com súmula contestada', () => {
    const r = evaluateReadiness({
      hasWorkoutLink: true,
      heats: [done(1)],
      scoreStatuses: ['validated', 'contested'],
      validResults: 1,
    });
    expect(r.canConfirm).toBe(false);
    expect(r.blockers.length).toBe(1);
  });

  it('bloqueia sem nenhuma súmula válida', () => {
    const r = evaluateReadiness({ hasWorkoutLink: true, heats: [done(1)], scoreStatuses: [], validResults: 0 });
    expect(r.canConfirm).toBe(false);
    expect(r.blockers.join(' ')).toContain('nenhuma súmula válida');
  });

  it('draft é só aviso', () => {
    const r = evaluateReadiness({ hasWorkoutLink: true, heats: [done(1)], scoreStatuses: ['draft', 'validated'], validResults: 1 });
    expect(r.canConfirm).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(r.warnings.length).toBe(1);
  });

  it('sem vínculo ou sem baterias: aviso e pode confirmar', () => {
    const a = evaluateReadiness({ hasWorkoutLink: false, heats: [], scoreStatuses: [], validResults: 1 });
    const b = evaluateReadiness({ hasWorkoutLink: true, heats: [], scoreStatuses: [], validResults: 1 });
    for (const r of [a, b]) {
      expect(r.canConfirm).toBe(true);
      expect(r.warnings.join(' ')).toContain('sem baterias cadastradas');
    }
  });

  it('tudo ok: sem blockers nem warnings', () => {
    const r = evaluateReadiness({ hasWorkoutLink: true, heats: [done(1), done(2)], scoreStatuses: ['validated'], validResults: 1 });
    expect(r).toEqual({ canConfirm: true, blockers: [], warnings: [], heats: { total: 2, completed: 2, pending: [] } });
  });
});

describe('officialState', () => {
  const ok = evaluateReadiness({ hasWorkoutLink: true, heats: [done(1)], scoreStatuses: [], validResults: 1 });
  const bad = evaluateReadiness({ hasWorkoutLink: true, heats: [done(1)], scoreStatuses: [], validResults: 0 });
  it('confirmado vence', () => expect(officialState(bad, true)).toBe('confirmed'));
  it('sem blockers é ready', () => expect(officialState(ok, false)).toBe('ready'));
  it('com blockers é blocked', () => expect(officialState(bad, false)).toBe('blocked'));
});

describe('parseRevertReason', () => {
  it('vazio vira null', () => expect(parseRevertReason('  ')).toBeNull());
  it('não string vira null', () => expect(parseRevertReason(undefined)).toBeNull());
  it('5 caracteres vale', () => expect(parseRevertReason('curto')).toBe('curto'));
  it('4 caracteres não', () => expect(parseRevertReason('curt')).toBeNull());
  it('301 caracteres não', () => expect(parseRevertReason('a'.repeat(301))).toBeNull());
  it('300 vale e apara', () => expect(parseRevertReason('  ' + 'a'.repeat(300) + ' ')).toBe('a'.repeat(300)));
});
