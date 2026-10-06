import { GameEvent, Category, WorkoutRule, TeamRegistration, ScoreEntry, Heat, OrganizationTenant } from '@/types';
import { DEFAULT_SUMULA_TEMPLATES } from './sumula-presets';

export const MOCK_ORGANIZATIONS: OrganizationTenant[] = [
  {
    id: 'org_1',
    name: 'Arena Games Brasil',
    slug: 'arena-games-brasil',
    ownerName: 'Carlos Mendonça',
    ownerEmail: 'carlos@arenagames.com.br',
    plan: 'enterprise',
    feePerAthleteBrl: 4.50,
    totalEventsCreated: 12,
    totalAthletesRegistered: 1840,
    active: true
  },
  {
    id: 'org_2',
    name: 'HYROX Series Brasil',
    slug: 'hyrox-brasil',
    ownerName: 'Mariana Duarte',
    ownerEmail: 'mariana@hyroxbrasil.com.br',
    plan: 'pro',
    feePerAthleteBrl: 5.00,
    totalEventsCreated: 6,
    totalAthletesRegistered: 920,
    active: true
  }
];

export const MOCK_GAMES: GameEvent[] = [
  {
    id: 'game_cf_2026',
    organizationId: 'org_1',
    code: 'CPCF26',
    name: 'Copa dos Campeões CrossFit 2026',
    description: 'A maior competição de condicionamento do Sudeste com mais de 300 atletas e 3 arenas.',
    location: 'Ginásio do Ibirapuera, São Paulo - SP',
    startDate: '2026-10-15',
    endDate: '2026-10-17',
    eventType: 'crossfit',
    status: 'live',
    lanesCount: 8,
    scoringRules: {
      isLowestPointsBetter: false,
      hyroxChipTimingEnabled: false
    }
  },
  {
    id: 'game_hy_2026',
    organizationId: 'org_2',
    code: 'HYRX26',
    name: 'HYROX National Championship 2026',
    description: 'Etapa oficial de classificação para o Campeonato Mundial de HYROX. 8x 1km + 8 Workstations.',
    location: 'Centro de Convenções Anhembi, São Paulo - SP',
    startDate: '2026-11-20',
    endDate: '2026-11-21',
    eventType: 'hyrox',
    status: 'open_for_registrations',
    lanesCount: 12,
    scoringRules: {
      isLowestPointsBetter: true,
      hyroxChipTimingEnabled: true
    }
  }
];

export const MOCK_CATEGORIES: Category[] = [
  // 1. RX Masculino Individual
  {
    id: 'cat_rx_masc',
    gameId: 'game_cf_2026',
    name: 'RX Masculino Individual',
    description: 'Atletas de alto rendimento. Domínio de todos os movimentos ginásticos e LPO.',
    price: 250,
    type: 'crossfit',
    teamFormat: 'individual',
    maxAthletesPerTeam: 1,
    genderComposition: 'male',
    division: 'rx',
    ageRule: 'none',
    spotsTotal: 30,
    spotsFilled: 22
  },

  // 2. Master 110+ Quarteto Misto (Soma de Idades >= 110 anos, 2H + 2M)
  {
    id: 'cat_master_110_quartet',
    gameId: 'game_cf_2026',
    name: 'Master 110+ Quarteto Misto (2H + 2M)',
    description: 'Quarteto composto por 2 homens e 2 mulheres onde a soma das idades dos 4 atletas deve ser no mínimo 110 anos.',
    price: 680,
    type: 'crossfit',
    teamFormat: 'quartet',
    maxAthletesPerTeam: 4,
    genderComposition: 'mixed_2m_2f',
    division: 'master110',
    ageRule: 'sum_team_age',
    minSumTeamAge: 110,
    spotsTotal: 20,
    spotsFilled: 14
  },

  // 3. Master 35+ Feminino Individual (Idade mínima individual 35 anos)
  {
    id: 'cat_master_35_fem',
    gameId: 'game_cf_2026',
    name: 'Master 35+ Feminino Individual',
    description: 'Mulheres com idade a partir de 35 anos completos.',
    price: 230,
    type: 'crossfit',
    teamFormat: 'individual',
    maxAthletesPerTeam: 1,
    genderComposition: 'female',
    division: 'master35',
    ageRule: 'min_individual_age',
    minIndividualAge: 35,
    spotsTotal: 24,
    spotsFilled: 18
  },

  // 4. Teen até 18 Anos (Idade máxima 18 anos)
  {
    id: 'cat_teen_misto',
    gameId: 'game_cf_2026',
    name: 'Teen Dupla Mista (Até 18 anos)',
    description: 'Jovens atletas de até 18 anos (1 Homem + 1 Mulher).',
    price: 320,
    type: 'crossfit',
    teamFormat: 'duo',
    maxAthletesPerTeam: 2,
    genderComposition: 'mixed_1m_1f',
    division: 'teen',
    ageRule: 'max_individual_age',
    maxIndividualAge: 18,
    spotsTotal: 16,
    spotsFilled: 8
  },

  // 5. HYROX Open Men Individual
  {
    id: 'cat_hyrox_open_men',
    gameId: 'game_hy_2026',
    name: 'HYROX Open Men Individual',
    description: '8x 1km Run + 8 estações funcionais com cargas oficiais padrão.',
    price: 290,
    type: 'hyrox',
    teamFormat: 'individual',
    maxAthletesPerTeam: 1,
    genderComposition: 'male',
    division: 'open',
    ageRule: 'none',
    spotsTotal: 50,
    spotsFilled: 38
  },

  // 6. HYROX Doubles Misto (1H + 1M)
  {
    id: 'cat_hyrox_doubles_mixed',
    gameId: 'game_hy_2026',
    name: 'HYROX Doubles Misto (1H + 1M)',
    description: 'Dupla formada por 1 homem e 1 mulher.',
    price: 490,
    type: 'hyrox',
    teamFormat: 'duo',
    maxAthletesPerTeam: 2,
    genderComposition: 'mixed_1m_1f',
    division: 'open',
    ageRule: 'none',
    spotsTotal: 30,
    spotsFilled: 24
  }
];

export const MOCK_WORKOUTS: WorkoutRule[] = [
  {
    id: 'wod_cf_1',
    gameId: 'game_cf_2026',
    categoryId: 'cat_rx_masc',
    title: 'WOD 1 - The Inferno (For Time)',
    type: 'for_time',
    timeCapSeconds: 600,
    description: '3 Rounds For Time:\n• 21 Cal Echo Bike\n• 15 Toes-to-Bar\n• 9 Thrusters (60kg)',
    movementStandards: [
      'Extensão completa de quadril e joelhos no topo do Thruster.',
      'Ambos os pés tocam simultaneamente a barra no Toes-to-Bar.'
    ],
    tieBreakMetric: 'time',
    pointsScale: 'standard_100'
  },
  {
    id: 'wod_cf_2',
    gameId: 'game_cf_2026',
    categoryId: 'cat_rx_masc',
    title: 'WOD 2 - Heavy Snatch Complex',
    type: 'complex',
    timeCapSeconds: 360,
    description: 'Dentro da janela de 6 minutos, achar a carga máxima do Complex:\n1 Snatch + 1 Hang Snatch + 1 Overhead Squat',
    movementStandards: [
      'Barra não pode tocar o chão entre o primeiro Snatch e o Hang Snatch.',
      'Quebra paralela obrigatória no Overhead Squat.'
    ],
    tieBreakMetric: 'time',
    pointsScale: 'standard_100'
  },
  {
    id: 'wod_hyrox_main',
    gameId: 'game_hy_2026',
    categoryId: 'cat_hyrox_open_men',
    title: 'HYROX 8-Stations Race',
    type: 'hyrox_standard',
    timeCapSeconds: 5400,
    description: 'Percurso oficial HYROX: 8x 1000m corrida intercalado com 8 estações funcionais.',
    movementStandards: [
      'Cumprir a distância e repetições exatas de cada estação antes de entrar no Roxzone de saída.'
    ]
  }
];

export const MOCK_TEAMS: TeamRegistration[] = [
  {
    id: 'team_cf_1',
    gameId: 'game_cf_2026',
    categoryId: 'cat_rx_masc',
    categoryName: 'RX Masculino Individual',
    teamName: 'Lucas "Thor" Silveira',
    registerNumber: '#101',
    amountPaid: 250,
    paymentStatus: 'paid',
    paymentMethod: 'pix',
    registeredAt: '2026-09-10',
    checkedIn: true,
    validationStatus: 'valid',
    athletes: [
      {
        id: 'ath_1',
        name: 'Lucas Silveira',
        cpf: '123.456.789-01',
        birthDate: '1995-04-12',
        age: 31,
        gender: 'M',
        boxOrAffiliate: 'CrossFit IronSP',
        checkIn: true,
        lgpdConsent: true
      }
    ]
  },
  {
    id: 'team_master_110',
    gameId: 'game_cf_2026',
    categoryId: 'cat_master_110_quartet',
    categoryName: 'Master 110+ Quarteto Misto',
    teamName: 'Os Imortais da Arena',
    registerNumber: '#201',
    amountPaid: 680,
    paymentStatus: 'paid',
    paymentMethod: 'credit_card',
    registeredAt: '2026-09-14',
    checkedIn: true,
    teamAgeSum: 154,
    validationStatus: 'valid',
    validationMessage: 'Soma de idades: 154 anos (Mínimo exigido: 110 anos)',
    athletes: [
      { id: 'ath_m1', name: 'Marcos Aurelio', birthDate: '1984-05-10', age: 42, gender: 'M', boxOrAffiliate: 'CF Morumbi', checkIn: true },
      { id: 'ath_m2', name: 'Renato Guimarães', birthDate: '1986-11-20', age: 40, gender: 'M', boxOrAffiliate: 'CF Morumbi', checkIn: true },
      { id: 'ath_f1', name: 'Cláudia Zanin', birthDate: '1989-02-15', age: 37, gender: 'F', boxOrAffiliate: 'CF Morumbi', checkIn: true },
      { id: 'ath_f2', name: 'Patricia Lopes', birthDate: '1991-08-30', age: 35, gender: 'F', boxOrAffiliate: 'CF Morumbi', checkIn: true }
    ]
  },
  {
    id: 'team_cf_2',
    gameId: 'game_cf_2026',
    categoryId: 'cat_rx_masc',
    categoryName: 'RX Masculino Individual',
    teamName: 'Gabriel Martins',
    registerNumber: '#102',
    amountPaid: 250,
    paymentStatus: 'paid',
    registeredAt: '2026-09-12',
    checkedIn: true,
    validationStatus: 'valid',
    athletes: [
      {
        id: 'ath_2',
        name: 'Gabriel Martins',
        cpf: '234.567.890-12',
        birthDate: '1998-07-22',
        age: 28,
        gender: 'M',
        boxOrAffiliate: 'Vanguard Fitness',
        checkIn: true
      }
    ]
  }
];

export const MOCK_SCORES: ScoreEntry[] = [
  {
    id: 'score_1',
    gameId: 'game_cf_2026',
    workoutId: 'wod_cf_1',
    categoryId: 'cat_rx_masc',
    registrationId: 'team_cf_1',
    teamName: 'Lucas "Thor" Silveira',
    registerNumber: '#101',
    heatNumber: 1,
    lane: 4,
    judgeName: 'Árbitro Roberto C.',
    timeFormatted: '06:14.2',
    timeSeconds: 374.2,
    isCompleted: true,
    isWO: false,
    isDisqualified: false,
    tieBreakSeconds: 124,
    tieBreakTimeFormatted: '02:04',
    scoreStatus: 'approved_by_head_judge',
    submittedAt: '2026-10-15T10:15:00Z',
    rankInWorkout: 1,
    finalPoints: 100
  }
];

export const MOCK_HEATS: Heat[] = [
  {
    id: 'heat_wod_cf_1_1',
    gameId: 'game_cf_2026',
    workoutId: 'wod_cf_1',
    categoryId: 'cat_rx_masc',
    heatNumber: 1,
    startTime: '09:00',
    status: 'completed',
    laneAssignments: [
      { lane: 4, registrationId: 'team_cf_1', teamName: 'Lucas "Thor" Silveira', registerNumber: '#101', athletes: ['Lucas Silveira'] },
      { lane: 5, registrationId: 'team_cf_2', teamName: 'Gabriel Martins', registerNumber: '#102', athletes: ['Gabriel Martins'] }
    ]
  }
];
