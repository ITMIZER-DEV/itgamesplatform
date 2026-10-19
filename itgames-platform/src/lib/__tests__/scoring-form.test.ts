import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POINTS_TABLE,
  parsePointsInput,
  formatPointsInput,
  tiebreakToForm,
  formToTiebreak,
  scoringDefaultsForEventType,
} from '../scoring-form';

describe('parsePointsInput', () => {
  it('aceita vírgula, espaço e quebra de linha', () => {
    expect(parsePointsInput('100, 95 90')).toEqual([100, 95, 90]);
    expect(parsePointsInput('100\n95,\n 90')).toEqual([100, 95, 90]);
  });
  it('só aceita inteiros: decimais e notação científica são inválidos', () => {
    expect(parsePointsInput('90.5')).toBeNull();
    expect(parsePointsInput('100, 90.5')).toBeNull();
    expect(parsePointsInput('1e3')).toBeNull();
    expect(parsePointsInput('90;80')).toEqual([90, 80]);
  });
  it('zero é válido', () => {
    expect(parsePointsInput('0')).toEqual([0]);
  });
  it('aceita zero', () => {
    expect(parsePointsInput('10, 0')).toEqual([10, 0]);
  });
  it('retorna null para vazio, não numérico ou negativo', () => {
    expect(parsePointsInput('')).toBeNull();
    expect(parsePointsInput('  , ')).toBeNull();
    expect(parsePointsInput('  ')).toBeNull();
    expect(parsePointsInput('a,b')).toBeNull();
    expect(parsePointsInput('-1')).toBeNull();
    expect(parsePointsInput('10, x')).toBeNull();
  });
  it('retorna null acima de 200 itens', () => {
    expect(parsePointsInput(Array(201).fill('1').join(','))).toBeNull();
    expect(parsePointsInput(Array(200).fill('1').join(','))).toHaveLength(200);
  });
});

describe('formatPointsInput', () => {
  it('formata separado por vírgula', () => {
    expect(formatPointsInput([100, 95])).toBe('100, 95');
  });
  it('a tabela padrão faz round-trip', () => {
    expect(parsePointsInput(formatPointsInput(DEFAULT_POINTS_TABLE))).toEqual(DEFAULT_POINTS_TABLE);
  });
});

describe('desempate no formulário', () => {
  it('converte do valor da API para o formulário', () => {
    expect(tiebreakToForm('last_workout')).toEqual({ kind: 'last_workout', split: '' });
    expect(tiebreakToForm('most_wins')).toEqual({ kind: 'most_wins', split: '' });
    expect(tiebreakToForm('split:Wall Balls')).toEqual({ kind: 'split', split: 'Wall Balls' });
    expect(tiebreakToForm(undefined)).toEqual({ kind: 'last_workout', split: '' });
  });
  it('converte do formulário para o valor da API', () => {
    expect(formToTiebreak('most_wins', '')).toBe('most_wins');
    expect(formToTiebreak('split', '  Wall Balls ')).toBe('split:Wall Balls');
    expect(formToTiebreak('split', '  ')).toBeNull();
  });
});

describe('scoringDefaultsForEventType', () => {
  it('HYROX usa tempo total e desempate pelo parcial Wall Balls', () => {
    expect(scoringDefaultsForEventType('hyrox')).toEqual({
      mode: 'total_time',
      tiebreakKind: 'split',
      tiebreakSplit: 'Wall Balls',
    });
  });
  it('CrossFit (e qualquer outro tipo) usa pontos por posição e último WOD', () => {
    const expected = { mode: 'points_table', tiebreakKind: 'last_workout', tiebreakSplit: '' };
    expect(scoringDefaultsForEventType('crossfit')).toEqual(expected);
    expect(scoringDefaultsForEventType('')).toEqual(expected);
  });
});
