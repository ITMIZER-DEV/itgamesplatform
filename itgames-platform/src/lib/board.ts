import { LeaderboardRank } from '@/types';

// Espelho do `Board` calculado pelo servidor (GET /events/:code/board).
export interface BoardResponse {
  game: {
    code: string;
    name: string;
    location: string;
    eventType: 'crossfit' | 'hyrox';
    rule: { mode: string; tiebreak: string };
    totalUnit: 'PTS' | 'SOMA' | 'TEMPO';
  };
  generatedAt: string;
  categories: {
    id: number;
    name: string;
    wodTitles: string[];
    rows: {
      rank: number;
      teamCode: number;
      team: string;
      number: string;
      athletes: string[];
      status: 'active' | 'cancelled';
      totalPoints: number;
      totalDisplay: string;
      wods: {
        title: string;
        display: string;
        rank: number;
        points: number;
        status: 'scored' | 'wo' | 'cancelled' | 'none';
      }[];
    }[];
  }[];
}

// Converte as linhas de uma categoria do placar do servidor no formato usado pelas telas.
export function toLeaderboardRanks(category: BoardResponse['categories'][number], unit: string): LeaderboardRank[] {
  return category.rows.map((row) => ({
    rank: row.rank,
    registrationId: String(row.teamCode),
    teamName: row.team,
    registerNumber: row.number,
    categoryName: category.name,
    athletes: row.athletes,
    totalPoints: row.totalPoints,
    totalDisplay: row.totalDisplay,
    totalUnit: unit,
    status: row.status,
    workoutScores: row.wods.map((wod, idx) => ({
      workoutId: String(idx),
      workoutTitle: wod.title,
      scoreDisplay: wod.display,
      rank: wod.rank,
      points: wod.points,
      status: wod.status,
      isApproved: wod.status === 'scored',
    })),
  }));
}

// Total exibido com a unidade (PTS/SOMA); TEMPO não leva sufixo.
export function formatTotal(rank: Pick<LeaderboardRank, 'totalDisplay' | 'totalPoints' | 'totalUnit'>): string {
  const value = rank.totalDisplay ?? String(rank.totalPoints);
  if (rank.totalUnit === 'TEMPO') return value;
  return `${value} ${rank.totalUnit === 'SOMA' ? 'soma' : 'pts'}`;
}
