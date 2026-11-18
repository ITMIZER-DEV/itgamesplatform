import { describe, it, expect } from 'vitest';
import { toLeaderboardRanks, chooseBoardGameCode, parseWodTitle, BoardResponse } from '../board';

type Category = BoardResponse['categories'][number];

const category: Category = {
  id: 1,
  name: 'RX Masculino',
  wodTitles: ['WOD 1', 'WOD 2'],
  rows: [
    {
      rank: 1,
      teamCode: 12,
      team: 'Time Alfa',
      number: '#101',
      athletes: ['Ana', 'Bia'],
      status: 'active',
      totalPoints: 195,
      totalDisplay: '195',
      wods: [
        { title: 'WOD 1', display: '05:10', rank: 1, points: 100, status: 'scored' },
        { title: 'WOD 2', display: '3 rds + 5 reps', rank: 2, points: 95, status: 'scored' },
      ],
    },
    {
      rank: 2,
      teamCode: 13,
      team: 'Time Beta',
      number: '#102',
      athletes: ['Caio'],
      status: 'cancelled',
      totalPoints: 0,
      totalDisplay: '-',
      wods: [
        { title: 'WOD 1', display: 'CANCELADA', rank: 0, points: 0, status: 'cancelled' },
        { title: 'WOD 2', display: '-', rank: 0, points: 0, status: 'none' },
      ],
    },
  ],
};

describe('toLeaderboardRanks', () => {
  it('mapeia posição, nome, número, atletas e total', () => {
    const [first] = toLeaderboardRanks(category, 'PTS');
    expect(first.rank).toBe(1);
    expect(first.registrationId).toBe('12');
    expect(first.teamName).toBe('Time Alfa');
    expect(first.registerNumber).toBe('#101');
    expect(first.categoryName).toBe('RX Masculino');
    expect(first.athletes).toEqual(['Ana', 'Bia']);
    expect(first.totalPoints).toBe(195);
    expect(first.totalDisplay).toBe('195');
    expect(first.totalUnit).toBe('PTS');
    expect(first.status).toBe('active');
  });

  it('mapeia o resultado de cada WOD', () => {
    const [first] = toLeaderboardRanks(category, 'PTS');
    expect(first.workoutScores).toHaveLength(2);
    expect(first.workoutScores[1]).toMatchObject({
      workoutTitle: 'WOD 2',
      scoreDisplay: '3 rds + 5 reps',
      rank: 2,
      points: 95,
      status: 'scored',
    });
  });

  it('mantém equipe cancelada na lista', () => {
    const ranks = toLeaderboardRanks(category, 'PTS');
    expect(ranks).toHaveLength(2);
    expect(ranks[1].status).toBe('cancelled');
    expect(ranks[1].workoutScores[0].status).toBe('cancelled');
  });

  it('categoria sem linhas gera lista vazia', () => {
    expect(toLeaderboardRanks({ ...category, rows: [] }, 'PTS')).toEqual([]);
  });
});

import { registrationCodeFromTeamId } from '../board';

describe('registrationCodeFromTeamId', () => {
  it('extrai o código de inscrições da API', () => {
    expect(registrationCodeFromTeamId('reg_12')).toBe('12');
  });
  it('retorna null para ids que não são inscrições da API', () => {
    expect(registrationCodeFromTeamId('team_abc')).toBeNull();
    expect(registrationCodeFromTeamId('reg_')).toBeNull();
    expect(registrationCodeFromTeamId('reg_x1')).toBeNull();
    expect(registrationCodeFromTeamId(undefined)).toBeNull();
  });
});

describe('chooseBoardGameCode', () => {
  const games = [{ code: 'A' }, { code: 'B' }, { code: 'C' }];
  it('o código pedido pela página vence ?game= e o campeonato ativo', () => {
    expect(chooseBoardGameCode(games, { requested: 'C', fromUrl: 'B', stored: 'A' })).toBe('C');
  });
  it('sem código pedido: ?game=, depois o ativo, depois o primeiro', () => {
    expect(chooseBoardGameCode(games, { fromUrl: 'B', stored: 'C' })).toBe('B');
    expect(chooseBoardGameCode(games, { stored: 'C' })).toBe('C');
    expect(chooseBoardGameCode(games, {})).toBe('A');
  });
  it('código desconhecido cai para o próximo critério', () => {
    expect(chooseBoardGameCode(games, { requested: 'X', fromUrl: 'Y', stored: 'B' })).toBe('B');
    expect(chooseBoardGameCode(games, { requested: 'X' })).toBe('A');
  });
});

describe('parseWodTitle', () => {
  it('separa títulos compostos com em-dash para WOD 1-A e subtítulo', () => {
    const res = parseWodTitle('WOD 1-A — 800m ROW', 0);
    expect(res.shortTitle).toBe('WOD 1-A');
    expect(res.subtitle).toBe('800m ROW');
  });

  it('separa títulos compostos para WOD 1-B e WOD 2', () => {
    const resB = parseWodTitle('WOD 1-B — DEATH BY', 1);
    expect(resB.shortTitle).toBe('WOD 1-B');
    expect(resB.subtitle).toBe('DEATH BY');

    const res2 = parseWodTitle('WOD 2 — SYNC & BURN', 2);
    expect(res2.shortTitle).toBe('WOD 2');
    expect(res2.subtitle).toBe('SYNC & BURN');
  });

  it('lida com títulos simples sem subtítulo', () => {
    const res = parseWodTitle('WOD 3', 2);
    expect(res.shortTitle).toBe('WOD 3');
    expect(res.subtitle).toBeUndefined();
  });

  it('usa fallback em títulos nulos ou vazios', () => {
    expect(parseWodTitle('', 0)).toEqual({ shortTitle: 'WOD 1' });
    expect(parseWodTitle(null, 1)).toEqual({ shortTitle: 'WOD 2' });
  });
});
