import { ruleChanged } from '../../src/modules/official/rule-changed';

describe('ruleChanged', () => {
  const base = { eventType: 'crossfit', scoringMode: null, tiebreak: null, pointsTable: null, isLowestPointsBetter: false };

  it('mesmos valores (ou padrão explícito) não contam como mudança', () => {
    expect(ruleChanged(base, { ...base })).toBe(false);
    expect(ruleChanged(base, { ...base, scoringMode: 'points_table', tiebreak: 'last_workout' })).toBe(false);
  });

  it('mudar o modo, o desempate ou a tabela conta como mudança', () => {
    expect(ruleChanged(base, { ...base, scoringMode: 'rank_sum' })).toBe(true);
    expect(ruleChanged(base, { ...base, tiebreak: 'most_wins' })).toBe(true);
    expect(ruleChanged(base, { ...base, pointsTable: [10, 5, 1] })).toBe(true);
  });

  it('muda o modo efetivo via isLowestPointsBetter ou hyrox', () => {
    expect(ruleChanged(base, { ...base, isLowestPointsBetter: true })).toBe(true);
    expect(ruleChanged(base, { ...base, eventType: 'hyrox' })).toBe(true);
  });

  it('eventType irrelevante quando o modo já é explícito', () => {
    const a = { ...base, scoringMode: 'rank_sum' };
    expect(ruleChanged(a, { ...a, eventType: 'hyrox' })).toBe(false);
  });
});
