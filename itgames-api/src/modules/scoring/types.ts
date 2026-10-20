import { ScoringMode, Tiebreak } from './rules';

export type TeamStatus = 'active' | 'cancelled';
export type WodStatus = 'scored' | 'wo' | 'cancelled' | 'none';

export interface EngineScore {
  workoutCode: number;
  category: number;
  teamCode: number;
  time?: string | null;
  weight?: string | null;
  reps?: string | null;
  penaltySeconds?: number | null;
  tieBreakTime?: string | null;
  isWO?: boolean | null;
  voided?: boolean;
  splits?: { name: string; seconds: number }[] | null;
}

export interface EngineInput {
  game: {
    code: string;
    name: string;
    location?: string | null;
    eventType?: string | null;
    scoringMode?: string | null;
    tiebreak?: string | null;
    pointsTable?: unknown;
    isLowestPointsBetter?: boolean | null;
  };
  categories: { code: number; name: string }[];
  workouts: { code: number; category: number; title?: string | null; type?: string | null; timeCap?: string | null }[];
  teams: {
    code: number;
    categoryId: number;
    team: string;
    number?: string | null;
    athletes: string[];
    status: TeamStatus;
  }[];
  scores: EngineScore[];
  /** Quando informado, só os WODs deste conjunto entram no cálculo. */
  onlyWorkouts?: ReadonlySet<number>;
}

export interface BoardWod {
  title: string;
  display: string;
  rank: number;
  points: number;
  status: WodStatus;
}

export interface BoardRow {
  rank: number;
  teamCode: number;
  team: string;
  number: string;
  athletes: string[];
  status: TeamStatus;
  /** Pontos, soma de posições ou segundos totais, conforme a regra. */
  totalPoints: number;
  /** Texto exibido para o total. */
  totalDisplay: string;
  wods: BoardWod[];
}

export interface Board {
  game: {
    code: string;
    name: string;
    location: string;
    eventType: 'crossfit' | 'hyrox';
    rule: { mode: ScoringMode; tiebreak: Tiebreak };
    totalUnit: 'PTS' | 'SOMA' | 'TEMPO';
    /** false no placar parcial (pontos zerados); true no oficial e na visão completa. */
    pointsVisible?: boolean;
    view?: 'partial' | 'official';
    /** Visão oficial sem nenhum WOD confirmado ainda. */
    awaitingOfficial?: boolean;
  };
  generatedAt: string;
  categories: { id: number; name: string; wodTitles: string[]; rows: BoardRow[] }[];
}

/** Resultado de um WOD por equipe, com dados extras usados só no modo total_time. */
export type WodEntry = BoardWod & { seconds?: number; splits?: { name: string; seconds: number }[] };
