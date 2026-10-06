import { Category, GameEvent, Heat, TeamRegistration, WorkoutRule } from '@/types';
import { parseTimeToSeconds } from './scoring';

// Conversores API → tipos das telas. Funções puras: não acessam rede nem navegador.

const GAME_STATUSES: GameEvent['status'][] = ['draft', 'open_for_registrations', 'live', 'finished', 'blocked'];
const HEAT_STATUSES: Heat['status'][] = ['scheduled', 'calling', 'in_progress', 'completed'];

export function mapGame(g: any): GameEvent {
  const code = String(g.code);
  const date = g.date ? String(g.date).slice(0, 10) : '';
  const eventType: GameEvent['eventType'] = g.eventType === 'hyrox' ? 'hyrox' : 'crossfit';
  return {
    id: code,
    // valor de preenchimento: os campeonatos reais não têm organização local (mesmo valor da tela de inscrição)
    organizationId: 'org_1',
    code,
    name: g.name || code,
    description: g.description || '',
    location: g.location || '',
    startDate: date,
    endDate: date,
    eventType,
    status: GAME_STATUSES.includes(g.status) ? g.status : 'draft',
    foto: g.foto || undefined,
    organizers: g.organizers,
    lanesCount: Number(g.lanesCount) || 8,
    pixKey: g.pixKey || undefined,
    pixBeneficiary: g.pixBeneficiary || undefined,
    scoringRules: {
      isLowestPointsBetter: !!g.isLowestPointsBetter,
      hyroxChipTimingEnabled: eventType === 'hyrox',
    },
  };
}

export function mapCategory(c: any, gameCode: string, eventType: GameEvent['eventType'] = 'crossfit'): Category {
  const ageRule = c.minTeamSumAge
    ? 'sum_team_age'
    : c.minIndividualAge
      ? 'min_individual_age'
      : c.maxIndividualAge
        ? 'max_individual_age'
        : 'none';
  return {
    id: String(c.code),
    gameId: gameCode,
    name: c.name,
    description: c.description || '',
    standards: c.standards || '',
    price: c.amount || 0,
    type: eventType,
    teamFormat: c.teamType || 'individual',
    maxAthletesPerTeam: c.maxAthlete || 1,
    genderComposition: c.genderRule || 'open',
    division: 'open',
    ageRule,
    minIndividualAge: c.minIndividualAge ?? undefined,
    maxIndividualAge: c.maxIndividualAge ?? undefined,
    minSumTeamAge: c.minTeamSumAge ?? undefined,
    spotsTotal: c.maxRegistrations ?? 0,
    spotsFilled: c.registrationsCount ?? 0,
    maxRegistrations: c.maxRegistrations ?? null,
    registrationsCount: c.registrationsCount ?? 0,
  } as unknown as Category;
}

export function mapWorkout(w: any, gameCode: string): WorkoutRule {
  return {
    id: String(w.code),
    gameId: gameCode,
    categoryId: String(w.category),
    title: w.title || `WOD ${w.code}`,
    type: (w.type as WorkoutRule['type']) || 'for_time',
    timeCapSeconds: parseTimeToSeconds(w.timeCap || ''),
    description: w.description || '',
    movementStandards: [],
  };
}

export function mapRegistration(r: any, gameCode: string, categoryName?: string): TeamRegistration {
  return {
    id: String(r.code),
    gameId: gameCode,
    categoryId: String(r.categoryId),
    categoryName: categoryName || '',
    teamName: r.team,
    registerNumber: r.number || `#${r.code}`,
    amountPaid: r.status === 'paid' ? r.amount || 0 : 0,
    paymentStatus: r.status === 'paid' ? 'paid' : 'pending',
    registeredAt: '',
    checkedIn: !!r.check,
    athletes: (r.athletes || []).map((a: any) => ({
      id: `ath_${r.code}_${a.code}`,
      name: a.name,
      gender: a.gender === 'F' ? 'F' : 'M',
      checkIn: false,
    })),
  } as unknown as TeamRegistration;
}

export function mapHeat(h: any, gameCode: string): Heat {
  const slots = [...(h.slots || [])].sort((a: any, b: any) => a.laneNumber - b.laneNumber);
  return {
    id: String(h.id),
    gameId: gameCode,
    workoutId: String(h.workoutCode),
    categoryId: String(h.categoryId),
    heatNumber: Number(h.heatNumber),
    startTime: h.startTime || '',
    status: HEAT_STATUSES.includes(h.status) ? h.status : 'scheduled',
    laneAssignments: slots.map((s: any) => ({
      slotId: s.id,
      lane: s.laneNumber,
      registrationId: String(s.teamCode),
      teamName: s.registration?.team ?? `Equipe ${s.teamCode}`,
      registerNumber: s.registration?.number ?? `#${s.teamCode}`,
      athletes: (s.registration?.athletes || []).map((a: any) => a.name),
    })),
  };
}

// Campeonato ativo: a preferência salva, se ainda estiver na lista; senão o primeiro; sem lista, nenhum.
export function pickActiveGame(games: GameEvent[], preferredCode: string): GameEvent | null {
  return games.find((g) => g.code === preferredCode) ?? games[0] ?? null;
}
