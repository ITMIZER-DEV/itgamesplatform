import { BadRequestException } from '@nestjs/common';
import { affectsBoard, normalizeGameScoring } from '../../src/modules/scoring/game-config';

describe('normalizeGameScoring', () => {
  it('rank_sum liga isLowestPointsBetter', () => {
    expect(normalizeGameScoring({ scoringMode: 'rank_sum' })).toEqual({
      scoringMode: 'rank_sum',
      isLowestPointsBetter: true,
    });
  });

  it('points_table e total_time zeram isLowestPointsBetter', () => {
    expect(normalizeGameScoring({ scoringMode: 'points_table' }).isLowestPointsBetter).toBe(false);
    expect(normalizeGameScoring({ scoringMode: 'total_time' }).isLowestPointsBetter).toBe(false);
  });

  it('sem campos retorna patch vazio (não mexe em isLowestPointsBetter)', () => {
    expect(normalizeGameScoring({})).toEqual({});
  });

  it('modo inventado => BadRequest', () => {
    expect(() => normalizeGameScoring({ scoringMode: 'inventado' })).toThrow(BadRequestException);
  });

  it('pointsTable vazia ou com negativo => BadRequest', () => {
    expect(() => normalizeGameScoring({ pointsTable: [] })).toThrow(BadRequestException);
    expect(() => normalizeGameScoring({ pointsTable: [-5] })).toThrow(BadRequestException);
  });

  it('pointsTable válida é aceita', () => {
    expect(normalizeGameScoring({ pointsTable: [10, 5, 0] }).pointsTable).toEqual([10, 5, 0]);
  });

  it('tiebreak split:Wall Balls aceito, xyz => BadRequest', () => {
    expect(normalizeGameScoring({ tiebreak: 'split:Wall Balls' }).tiebreak).toBe('split:Wall Balls');
    expect(() => normalizeGameScoring({ tiebreak: 'xyz' })).toThrow(BadRequestException);
  });

  it('null limpa os campos', () => {
    expect(normalizeGameScoring({ scoringMode: null, tiebreak: null, pointsTable: null })).toEqual({
      scoringMode: null,
      tiebreak: null,
      pointsTable: null,
    });
  });
});

describe('affectsBoard', () => {
  it('é verdadeiro quando o patch muda algo que entra na classificação', () => {
    expect(affectsBoard({ scoringMode: 'rank_sum' })).toBe(true);
    expect(affectsBoard({ tiebreak: 'most_wins' })).toBe(true);
    expect(affectsBoard({ pointsTable: [10, 5] })).toBe(true);
    expect(affectsBoard({ eventType: 'hyrox' })).toBe(true);
    expect(affectsBoard({ isLowestPointsBetter: true })).toBe(true);
    expect(affectsBoard({ scoringMode: null })).toBe(true);
  });

  it('é falso para campos que não alteram a classificação', () => {
    expect(affectsBoard({})).toBe(false);
    expect(affectsBoard({ name: 'Novo nome', location: 'Arena', lanesCount: 4 })).toBe(false);
  });
});
