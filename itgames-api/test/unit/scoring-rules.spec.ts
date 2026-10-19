import { formatTime } from '../../src/modules/scoring/workout-order';
import {
  DEFAULT_POINTS_TABLE,
  parsePointsTable,
  parseTiebreak,
  pointsForPosition,
  resolveRule,
} from '../../src/modules/scoring/rules';

describe('resolveRule', () => {
  it('deriva total_time para eventType hyrox', () => {
    expect(resolveRule({ eventType: 'hyrox' }).mode).toBe('total_time');
  });

  it('deriva rank_sum quando isLowestPointsBetter', () => {
    expect(resolveRule({ isLowestPointsBetter: true }).mode).toBe('rank_sum');
  });

  it('usa os padrões quando nada é informado', () => {
    const r = resolveRule({});
    expect(r.mode).toBe('points_table');
    expect(r.pointsTable).toEqual(DEFAULT_POINTS_TABLE);
    expect(r.tiebreak).toBe('last_workout');
  });

  it('scoringMode explícito vence o eventType', () => {
    expect(resolveRule({ scoringMode: 'points_table', eventType: 'hyrox' }).mode).toBe('points_table');
  });

  it('scoringMode inválido cai na derivação legada', () => {
    expect(resolveRule({ scoringMode: 'lixo', eventType: 'hyrox' }).mode).toBe('total_time');
  });
});

describe('parsePointsTable', () => {
  it('rejeita entradas inválidas', () => {
    expect(parsePointsTable([])).toBeNull();
    expect(parsePointsTable([-1])).toBeNull();
    expect(parsePointsTable(['a'])).toBeNull();
    expect(parsePointsTable('x')).toBeNull();
  });

  it('aceita tabela válida', () => {
    expect(parsePointsTable([100, 50])).toEqual([100, 50]);
  });
});

describe('parseTiebreak', () => {
  it('aceita split com texto', () => {
    expect(parseTiebreak('split:Wall Balls')).toBe('split:Wall Balls');
  });

  it('rejeita inválidos', () => {
    expect(parseTiebreak('split:')).toBeNull();
    expect(parseTiebreak('x')).toBeNull();
  });
});

describe('pointsForPosition', () => {
  it('calcula pontos pela posição', () => {
    expect(pointsForPosition(DEFAULT_POINTS_TABLE, 1)).toBe(100);
    expect(pointsForPosition(DEFAULT_POINTS_TABLE, 31)).toBe(1);
    expect(pointsForPosition(DEFAULT_POINTS_TABLE, 99)).toBe(1);
    expect(pointsForPosition(DEFAULT_POINTS_TABLE, 0)).toBe(0);
  });
});

describe('formatTime', () => {
  it('arredonda em décimos sem imprimir 01:05.10', () => {
    expect(formatTime(65.04)).toBe('01:05');
    expect(formatTime(65.96)).toBe('01:06');
    expect(formatTime(65.5)).toBe('01:05.5');
    expect(formatTime(3599.97)).toBe('60:00');
  });
});
