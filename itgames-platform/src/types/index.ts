export type EventType = 'crossfit' | 'hyrox' | 'fitness_racing';

export type WorkoutType = 
  | 'for_time' 
  | 'amrap' 
  | 'emom' 
  | 'max_load' 
  | 'complex' 
  | 'hyrox_standard' 
  | 'hyrox_relay' 
  | 'custom_circuit';

export type TeamFormat = 'individual' | 'duo' | 'trio' | 'quartet' | 'relay';

export type GenderComposition = 'male' | 'female' | 'mixed_1m_1f' | 'mixed_2m_2f' | 'open';

export type AgeValidationRule = 'none' | 'min_individual_age' | 'max_individual_age' | 'sum_team_age';

export interface Athlete {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
  birthDate?: string; // YYYY-MM-DD
  age?: number;
  gender: 'M' | 'F';
  tshirtSize?: 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XGG';
  boxOrAffiliate?: string;
  checkIn: boolean;
  checkInAt?: string;
  lgpdConsent?: boolean;
}

export interface TeamRegistration {
  id: string;
  gameId: string;
  categoryId: string;
  categoryName: string;
  teamName: string;
  registerNumber: string; // Ex: #101
  amountPaid: number;
  paymentStatus: 'paid' | 'pending' | 'free' | 'cancelled';
  paymentMethod?: 'pix' | 'credit_card' | 'manual';
  proofOfPaymentUrl?: string;
  proofUploadedAt?: string;
  registeredAt: string;
  checkedIn: boolean;
  athletes: Athlete[];
  assignedHeatId?: string;
  assignedLane?: number;
  teamAgeSum?: number;
  validationStatus: 'valid' | 'invalid_age' | 'invalid_gender';
  validationMessage?: string;
}

export interface Category {
  id: string;
  gameId: string;
  name: string; // Ex: 'Master 110+ Quarteto Misto', 'RX Masculino Individual', 'HYROX Open Men'
  description?: string;
  standards?: string;
  price: number;
  type: EventType;
  teamFormat: TeamFormat;
  maxAthletesPerTeam: number; // 1, 2, 3, 4
  genderComposition: GenderComposition;
  division: 'scale' | 'inter' | 'rx' | 'elite' | 'master35' | 'master40' | 'master110' | 'teen' | 'open' | 'pro' | 'relay';
  
  // Regras Avançadas de Validação de Idade (Casos de Uso)
  ageRule: AgeValidationRule;
  minIndividualAge?: number; // Ex: 35 (Master 35+)
  maxIndividualAge?: number; // Ex: 18 (Teen até 18 anos)
  minSumTeamAge?: number;    // Ex: 110 (Time Master somando idade mínima de 110 anos)
  
  spotsTotal: number; // Limite de vagas
  spotsFilled: number;
}

export interface HyroxStation {
  id: number;
  name: string;
  distanceOrReps: string;
  defaultCapMinutes?: number;
}

export interface WorkoutRule {
  id: string;
  gameId: string;
  categoryId: string;
  title: string;
  type: WorkoutType;
  timeCapSeconds: number;
  description: string;
  movementStandards: string[];
  tieBreakMetric?: 'time' | 'reps' | 'none';
  pointsScale?: 'standard_100' | 'linear_rank' | 'time_based';
  hyroxStations?: HyroxStation[];
}

export interface Heat {
  id: string;
  gameId: string;
  workoutId: string;
  categoryId: string;
  heatNumber: number;
  startTime: string;
  status: 'scheduled' | 'calling' | 'in_progress' | 'completed';
  laneAssignments: {
    lane: number;
    registrationId: string;
    teamName: string;
    registerNumber: string;
    athletes: string[];
  }[];
}

export interface AuditLogEntry {
  id: string;
  scoreId: string;
  gameId: string;
  workoutId: string;
  registrationId: string;
  changedBy: string;
  role: 'judge' | 'head_judge' | 'admin';
  action: 'create' | 'update' | 'approve' | 'reject' | 'penalty_applied' | 'photo_attached';
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  timestamp: string;
  ipOrDevice?: string;
}

export interface ContestTicket {
  id: string;
  gameId: string;
  workoutId: string;
  workoutTitle: string;
  registrationId: string;
  teamName: string;
  registerNumber: string;
  reason: string;
  status: 'pending' | 'in_review' | 'approved_changed' | 'rejected_kept';
  submittedAt: string;
  reviewedBy?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
}

export interface ScoreEntry {
  id: string;
  gameId: string;
  workoutId: string;
  categoryId: string;
  registrationId: string;
  teamName: string;
  registerNumber: string;
  heatNumber?: number;
  lane?: number;
  judgeName: string;
  judgeCpf?: string;
  timeFormatted?: string;
  timeSeconds?: number;
  repsCount?: number;
  roundsCount?: number;
  weightLoadedKg?: number;
  tieBreakTimeFormatted?: string;
  tieBreakSeconds?: number;
  isCompleted: boolean;
  isWO: boolean;
  isDisqualified: boolean;
  penaltiesSeconds?: number;
  penaltyNotes?: string;
  athleteSignatureUrl?: string;
  photoSumulaUrl?: string;
  scoreStatus: 'draft' | 'submitted_by_judge' | 'approved_by_head_judge' | 'contested';
  contestReason?: string;
  submittedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  finalPoints?: number;
  rankInWorkout?: number;
  auditLogs?: AuditLogEntry[];
}

export interface LeaderboardRank {
  rank: number;
  registrationId: string;
  teamName: string;
  registerNumber: string;
  categoryName: string;
  boxOrAffiliate?: string;
  athletes: string[];
  totalPoints: number;
  totalTimeSeconds?: number;
  workoutScores: {
    workoutId: string;
    workoutTitle: string;
    scoreDisplay: string;
    rank: number;
    points: number;
    timeSeconds?: number;
    photoSumulaUrl?: string;
    isApproved: boolean;
  }[];
}

export interface SumulaTemplate {
  id: string;
  name: string;
  type: EventType;
  workoutType: WorkoutType;
  gameId?: string;
  categoryId?: string;
  workoutId?: string;
  htmlContent: string;
  isDefault: boolean;
  createdAt: string;
}

export interface GameEvent {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  eventType: EventType;
  status: 'draft' | 'open_for_registrations' | 'live' | 'finished' | 'blocked';
  bannerUrl?: string;
  logoUrl?: string;
  foto?: string;
  organizers?: { id: string; name: string; email?: string; phoneNumber?: string | null }[];
  lanesCount: number;
  pixKey?: string;
  pixBeneficiary?: string;
  pixKeyType?: 'email' | 'cpf' | 'cnpj' | 'phone' | 'random';
  scoringRules: {
    isLowestPointsBetter: boolean;
    hyroxChipTimingEnabled: boolean;
  };
}


export interface OrganizationTenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  ownerName: string;
  ownerEmail: string;
  plan: 'free' | 'pro' | 'enterprise';
  feePerAthleteBrl: number;
  totalEventsCreated: number;
  totalAthletesRegistered: number;
  active: boolean;
}

export interface JudgeStaff {
  id: string;
  gameId: string;
  name: string;
  email: string;
  phone?: string;
  pinCode: string; // PIN de 4 dígitos para login rápido no tablet
  assignedLanes: number[]; // Raias atribuídas ex: [1, 2] ou todas
  status: 'active' | 'inactive' | 'in_lane';
  role: 'head_judge' | 'floor_judge' | 'hyrox_station_judge';
  stationName?: string; // Ex: "Estação 3 - Sled Pull"
  createdAt?: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ORGANIZER' | 'JUDGE' | 'ATHLETE';
  organizationId?: string;
  athleteId?: string;
}
