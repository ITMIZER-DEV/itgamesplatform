import { describe, it, expect } from 'vitest';
import { toLeaderboardRanks, BoardResponse } from '../board';

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
