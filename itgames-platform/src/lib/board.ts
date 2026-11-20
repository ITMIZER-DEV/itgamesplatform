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
    status?: string;
    showScoreRevision?: boolean;
  };
  generatedAt: string;
  categories: {
    id: number;
    name: string;
    wodTitles: string[];
    frozen?: boolean;
    frozenAt?: string | null;
    overlayText?: string | null;
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

export interface FormattedWodTitle {
  shortTitle: string;
  subtitle?: string;
}

// Extrai o identificador limpo do WOD (ex: "WOD 1-A", "WOD 1-B", "WOD 2") e seu subtítulo
export function parseWodTitle(title: string | undefined | null, fallbackIndex?: number): FormattedWodTitle {
  const defaultTitle = fallbackIndex !== undefined ? `WOD ${fallbackIndex + 1}` : 'WOD';
  if (!title || !title.trim()) {
    return { shortTitle: defaultTitle };
  }

  const raw = title.trim();

  // Caso 1: Separador de travessão em-dash (—) ou en-dash (–)
  if (raw.includes('—') || raw.includes('–')) {
    const parts = raw.split(/[—–]/);
    const short = parts[0].trim();
    const sub = parts.slice(1).join('—').trim();
    return {
      shortTitle: short || defaultTitle,
      subtitle: sub || undefined,
    };
  }

  // Caso 2: Padrão explícito com prefixo (WOD 1-A, PROVA 1-B, EVENT 1.1) seguido de dois pontos ou hífen
  const matchWodSub = raw.match(/^((?:WOD|PROVA|EVENT)\s*\d+[\s\-_/]*[A-Za-z0-9]*)\s*[:\-\—]?\s*(.*)$/i);
  if (matchWodSub && matchWodSub[1]) {
    const short = matchWodSub[1].trim();
    const sub = matchWodSub[2]?.trim();
    return {
      shortTitle: short,
      subtitle: sub || undefined,
    };
  }

  // Caso 3: Separador com dois pontos ':'
  if (raw.includes(':')) {
    const parts = raw.split(':');
    return {
      shortTitle: parts[0].trim() || defaultTitle,
      subtitle: parts.slice(1).join(':').trim() || undefined,
    };
  }

  // Caso 4: Hífen com espaços ao redor " - "
  if (raw.includes(' - ')) {
    const parts = raw.split(' - ');
    return {
      shortTitle: parts[0].trim() || defaultTitle,
      subtitle: parts.slice(1).join(' - ').trim() || undefined,
    };
  }

  return { shortTitle: raw };
}

// Ordena WODs em ordem natural pelo título (ex.: WOD 1-A, WOD 1-B, WOD 2, WOD 3), com fallback para code/id.
export function sortWorkoutsNaturally<T extends { title?: string | null; code?: number; id?: string }>(workouts: T[]): T[] {
  return [...workouts].sort((a, b) => {
    const titleA = (a.title || '').trim();
    const titleB = (b.title || '').trim();
    if (titleA && titleB) {
      const cmp = titleA.localeCompare(titleB, 'pt-BR', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    } else if (titleA || titleB) {
      return titleA ? -1 : 1;
    }
    if (a.code !== undefined && b.code !== undefined && a.code !== b.code) {
      return a.code - b.code;
    }
    return String(a.id || '').localeCompare(String(b.id || ''), 'pt-BR', { numeric: true });
  });
}

// Código da inscrição na API a partir do id local da equipe ("reg_12" -> "12"); null se não for da API.
export function registrationCodeFromTeamId(id?: string | null): string | null {
  const m = /^reg_(\d+)$/.exec(id ?? '');
  return m ? m[1] : null;
}

// Escolhe o campeonato do placar: o código pedido pela página, ?game= da URL, o último aberto, o primeiro.
// Códigos que não existem na lista caem para o próximo critério.
export function chooseBoardGameCode(
  games: { code: string }[],
  opts: { requested?: string | null; fromUrl?: string | null; stored?: string | null },
): string {
  for (const wanted of [opts.requested, opts.fromUrl, opts.stored]) {
    if (wanted && games.some((g) => g.code === wanted)) return wanted;
  }
  return games[0].code;
}
