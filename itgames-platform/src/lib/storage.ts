import {
  GameEvent,
  Category,
  WorkoutRule,
  TeamRegistration,
  ScoreEntry,
  Heat,
  SumulaTemplate,
  OrganizationTenant,
  AuditLogEntry,
  ContestTicket,
  JudgeStaff
} from '@/types';
import {
  MOCK_GAMES,
  MOCK_CATEGORIES,
  MOCK_WORKOUTS,
  MOCK_TEAMS,
  MOCK_SCORES,
  MOCK_HEATS,
  MOCK_ORGANIZATIONS
} from './mock-data';
import { DEFAULT_SUMULA_TEMPLATES } from './sumula-presets';

const STORAGE_KEYS = {
  GAMES: 'itgames_data_games',
  CATEGORIES: 'itgames_data_categories',
  WORKOUTS: 'itgames_data_workouts',
  TEAMS: 'itgames_data_teams',
  SCORES: 'itgames_data_scores',
  HEATS: 'itgames_data_heats',
  TEMPLATES: 'itgames_data_sumula_templates',
  ORGANIZATIONS: 'itgames_data_organizations',
  AUDIT_LOGS: 'itgames_data_audit_logs',
  CONTEST_TICKETS: 'itgames_data_contest_tickets',
  JUDGES: 'itgames_data_judges',
  ACTIVE_GAME_ID: 'itgames_active_game_id'
};

class DataStorage {
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private getItem<T>(key: string, defaultValue: T): T {
    if (!this.isBrowser()) return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error(`Erro ao carregar chave ${key}:`, e);
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new Event('itgames_storage_updated'));
    } catch (e) {
      console.error(`Erro ao salvar chave ${key}:`, e);
    }
  }

  public initDefaultsIfEmpty(): void {
    if (!this.isBrowser()) return;

    if (!localStorage.getItem(STORAGE_KEYS.GAMES)) {
      this.setItem(STORAGE_KEYS.GAMES, MOCK_GAMES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      this.setItem(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.WORKOUTS)) {
      this.setItem(STORAGE_KEYS.WORKOUTS, MOCK_WORKOUTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TEAMS)) {
      this.setItem(STORAGE_KEYS.TEAMS, MOCK_TEAMS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SCORES)) {
      this.setItem(STORAGE_KEYS.SCORES, MOCK_SCORES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.HEATS)) {
      this.setItem(STORAGE_KEYS.HEATS, MOCK_HEATS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TEMPLATES)) {
      this.setItem(STORAGE_KEYS.TEMPLATES, DEFAULT_SUMULA_TEMPLATES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORGANIZATIONS)) {
      this.setItem(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      this.setItem(STORAGE_KEYS.AUDIT_LOGS, [
        {
          id: 'log_init_1',
          scoreId: 'score_1',
          gameId: 'game_cf_2026',
          workoutId: 'wod_cf_1',
          registrationId: 'team_cf_1',
          changedBy: 'Árbitro Roberto C.',
          role: 'judge',
          action: 'create',
          newValue: '06:14.2 (100 pts)',
          reason: 'Lançamento inicial de campo via tablet do juiz',
          timestamp: '2026-10-15T10:15:00Z',
          ipOrDevice: 'Tablet Arena #4'
        },
        {
          id: 'log_init_2',
          scoreId: 'score_1',
          gameId: 'game_cf_2026',
          workoutId: 'wod_cf_1',
          registrationId: 'team_cf_1',
          changedBy: 'Head Judge Carlos M.',
          role: 'head_judge',
          action: 'approve',
          newValue: 'Aprovado e Homologado',
          reason: 'Conferência de súmula com assinatura do atleta',
          timestamp: '2026-10-15T10:20:00Z',
          ipOrDevice: 'Mesa Central de Arbitragem'
        }
      ] as AuditLogEntry[]);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CONTEST_TICKETS)) {
      this.setItem(STORAGE_KEYS.CONTEST_TICKETS, [] as ContestTicket[]);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_GAME_ID)) {
      this.setItem(STORAGE_KEYS.ACTIVE_GAME_ID, 'game_cf_2026');
    }
  }

  // Games
  public getGames(): GameEvent[] {
    return this.getItem<GameEvent[]>(STORAGE_KEYS.GAMES, MOCK_GAMES);
  }

  public getGameById(id: string): GameEvent | undefined {
    return this.getGames().find(g => g.id === id);
  }

  public saveGame(game: GameEvent): void {
    const games = this.getGames();
    const index = games.findIndex(g => g.id === game.id);
    if (index >= 0) {
      games[index] = game;
    } else {
      games.push(game);
    }
    this.setItem(STORAGE_KEYS.GAMES, games);
  }

  public deleteGame(gameId: string): void {
    const games = this.getGames().filter(g => g.id !== gameId && g.code !== gameId);
    this.setItem(STORAGE_KEYS.GAMES, games);
  }

  public getActiveGameId(): string {
    return this.getItem<string>(STORAGE_KEYS.ACTIVE_GAME_ID, 'ITGAMES2026');
  }

  public setActiveGameId(gameId: string): void {
    this.setItem(STORAGE_KEYS.ACTIVE_GAME_ID, gameId);
  }

  // Categories
  public getCategories(gameId?: string): Category[] {
    const list = this.getItem<Category[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    return gameId ? list.filter(c => c.gameId === gameId) : list;
  }

  public saveCategory(category: Category): void {
    const list = this.getCategories();
    const index = list.findIndex(c => c.id === category.id);
    if (index >= 0) {
      list[index] = category;
    } else {
      list.push(category);
    }
    this.setItem(STORAGE_KEYS.CATEGORIES, list);
  }

  public deleteCategory(categoryId: string): void {
    const list = this.getCategories().filter(c => c.id !== categoryId);
    this.setItem(STORAGE_KEYS.CATEGORIES, list);
  }

  // Workouts
  public getWorkouts(gameId?: string): WorkoutRule[] {
    const list = this.getItem<WorkoutRule[]>(STORAGE_KEYS.WORKOUTS, MOCK_WORKOUTS);
    return gameId ? list.filter(w => w.gameId === gameId) : list;
  }

  public saveWorkout(workout: WorkoutRule): void {
    const list = this.getWorkouts();
    const index = list.findIndex(w => w.id === workout.id);
    if (index >= 0) {
      list[index] = workout;
    } else {
      list.push(workout);
    }
    this.setItem(STORAGE_KEYS.WORKOUTS, list);
  }

  // Teams / Registrations
  public getTeams(gameId?: string): TeamRegistration[] {
    const list = this.getItem<TeamRegistration[]>(STORAGE_KEYS.TEAMS, MOCK_TEAMS);
    return gameId ? list.filter(t => t.gameId === gameId) : list;
  }

  public saveTeam(team: TeamRegistration): void {
    const list = this.getTeams();
    const index = list.findIndex(t => t.id === team.id);
    if (index >= 0) {
      list[index] = team;
    } else {
      list.push(team);
    }
    this.setItem(STORAGE_KEYS.TEAMS, list);
  }

  public deleteTeam(teamId: string): void {
    const list = this.getTeams().filter((t) => t.id !== teamId);
    this.setItem(STORAGE_KEYS.TEAMS, list);
  }

  // Scores
  public getScores(gameId?: string): ScoreEntry[] {
    const list = this.getItem<ScoreEntry[]>(STORAGE_KEYS.SCORES, MOCK_SCORES);
    return gameId ? list.filter(s => s.gameId === gameId) : list;
  }

  public saveScore(score: ScoreEntry, actorName: string = 'Juiz Oficial', role: 'judge' | 'head_judge' | 'admin' = 'judge', reason?: string): void {
    const list = this.getScores();
    const index = list.findIndex(s => s.id === score.id);
    const isNew = index < 0;

    let oldValue = undefined;
    if (!isNew) {
      const prev = list[index];
      oldValue = prev.timeFormatted || `${prev.weightLoadedKg || prev.repsCount} pts`;
      list[index] = score;
    } else {
      list.push(score);
    }

    this.setItem(STORAGE_KEYS.SCORES, list);

    // Registrar Trilha de Auditoria Imutável
    const newValue = score.timeFormatted || `${score.weightLoadedKg || score.repsCount} pts`;
    this.addAuditLog({
      id: `audit_${Date.now()}`,
      scoreId: score.id,
      gameId: score.gameId,
      workoutId: score.workoutId,
      registrationId: score.registrationId,
      changedBy: actorName,
      role,
      action: isNew ? 'create' : 'update',
      oldValue,
      newValue,
      reason: reason || (isNew ? 'Lançamento de score de campo' : 'Retificação / Auditoria de pontuação'),
      timestamp: new Date().toISOString(),
      ipOrDevice: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 40) : 'Sistema Central'
    });
  }

  // Auditoria
  public getAuditLogs(gameId?: string): AuditLogEntry[] {
    const logs = this.getItem<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    return gameId ? logs.filter(l => l.gameId === gameId) : logs;
  }

  public addAuditLog(log: AuditLogEntry): void {
    const logs = this.getAuditLogs();
    logs.unshift(log); // mais recentes primeiro
    this.setItem(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  // Tickets de Contestação
  public getContestTickets(gameId?: string): ContestTicket[] {
    const tickets = this.getItem<ContestTicket[]>(STORAGE_KEYS.CONTEST_TICKETS, []);
    return gameId ? tickets.filter(t => t.gameId === gameId) : tickets;
  }

  public saveContestTicket(ticket: ContestTicket): void {
    const tickets = this.getContestTickets();
    const index = tickets.findIndex(t => t.id === ticket.id);
    if (index >= 0) {
      tickets[index] = ticket;
    } else {
      tickets.unshift(ticket);
    }
    this.setItem(STORAGE_KEYS.CONTEST_TICKETS, tickets);
  }

  // Heats
  public getHeats(gameId?: string): Heat[] {
    const list = this.getItem<Heat[]>(STORAGE_KEYS.HEATS, MOCK_HEATS);
    return gameId ? list.filter(h => h.gameId === gameId) : list;
  }

  public saveHeats(heats: Heat[]): void {
    const current = this.getHeats();
    const gameId = heats[0]?.gameId;
    const workoutId = heats[0]?.workoutId;

    const filtered = current.filter(
      h => !(h.gameId === gameId && h.workoutId === workoutId)
    );
    const updated = [...filtered, ...heats];
    this.setItem(STORAGE_KEYS.HEATS, updated);
  }

  public updateHeatStatus(heatId: string, status: Heat['status']): void {
    const list = this.getHeats();
    const index = list.findIndex(h => h.id === heatId);
    if (index >= 0) {
      list[index].status = status;
      this.setItem(STORAGE_KEYS.HEATS, list);
    }
  }

  // Templates de Súmula
  public getSumulaTemplates(): SumulaTemplate[] {
    return this.getItem<SumulaTemplate[]>(STORAGE_KEYS.TEMPLATES, DEFAULT_SUMULA_TEMPLATES);
  }

  public saveSumulaTemplate(template: SumulaTemplate): void {
    const list = this.getSumulaTemplates();
    const index = list.findIndex(t => t.id === template.id);
    if (index >= 0) {
      list[index] = template;
    } else {
      list.push(template);
    }
    this.setItem(STORAGE_KEYS.TEMPLATES, list);
  }

  public deleteSumulaTemplate(templateId: string): void {
    const list = this.getSumulaTemplates().filter(t => t.id !== templateId);
    this.setItem(STORAGE_KEYS.TEMPLATES, list);
  }

  // Judges & Arbitragem
  public getJudges(gameId?: string): JudgeStaff[] {
    const defaultJudges: JudgeStaff[] = [
      {
        id: 'judge_1',
        gameId: 'game_cf_2026',
        name: 'Roberto Silveira (Head Judge)',
        email: 'judge@itgames.com.br',
        phone: '(11) 98888-1111',
        pinCode: '1234',
        assignedLanes: [1, 2, 3, 4, 5, 6, 7, 8],
        status: 'active',
        role: 'head_judge',
        createdAt: '2026-10-01T10:00:00Z'
      },
      {
        id: 'judge_2',
        gameId: 'game_cf_2026',
        name: 'Mariana Duarte (Juíza Raia 1 & 2)',
        email: 'mariana.juiza@itgames.com.br',
        phone: '(11) 97777-2222',
        pinCode: '2026',
        assignedLanes: [1, 2],
        status: 'in_lane',
        role: 'floor_judge',
        createdAt: '2026-10-01T10:00:00Z'
      },
      {
        id: 'judge_3',
        gameId: 'game_cf_2026',
        name: 'André Santos (Juiz Raia 3 & 4)',
        email: 'andre.judge@itgames.com.br',
        phone: '(11) 96666-3333',
        pinCode: '4321',
        assignedLanes: [3, 4],
        status: 'active',
        role: 'floor_judge',
        createdAt: '2026-10-01T10:00:00Z'
      }
    ];

    const list = this.getItem<JudgeStaff[]>(STORAGE_KEYS.JUDGES, defaultJudges);
    return gameId ? list.filter(j => j.gameId === gameId) : list;
  }

  public saveJudge(judge: JudgeStaff): void {
    const list = this.getJudges();
    const index = list.findIndex(j => j.id === judge.id);
    if (index >= 0) {
      list[index] = judge;
    } else {
      list.push(judge);
    }
    this.setItem(STORAGE_KEYS.JUDGES, list);
  }

  public deleteJudge(judgeId: string): void {
    const list = this.getJudges().filter(j => j.id !== judgeId);
    this.setItem(STORAGE_KEYS.JUDGES, list);
  }

  // Organizations
  public getOrganizations(): OrganizationTenant[] {
    return this.getItem<OrganizationTenant[]>(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  }

  // Reset
  public resetToDefaults(): void {
    if (!this.isBrowser()) return;
    localStorage.clear();
    this.initDefaultsIfEmpty();
    window.dispatchEvent(new Event('itgames_storage_updated'));
  }
}

export const storage = new DataStorage();
