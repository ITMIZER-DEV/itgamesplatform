import { ScoreEntry, Heat, AuditLogEntry, GameEvent, Category, WorkoutRule, TeamRegistration } from '@/types';
import { storage } from './storage';
import { getAuthToken, logoutUser } from './acl';

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    // No navegador, usa o proxy reverso interno do Next.js (/api-proxy)
    // Isso evita expor a porta 3334, elimina problemas de CORS e funciona com qualquer domínio/HTTPS.
    return '/api-proxy';
  }
  return process.env.API_INTERNAL_URL || 'http://127.0.0.1:3334';
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface OrganizerUser {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  mustChangePassword?: boolean;
  createdAt?: string;
  _count?: { organizedGames: number };
  // vínculo com um campeonato: false = suspenso naquele campeonato (só vem nas listas por campeonato)
  active?: boolean;
}

export interface AthleteAdminRow {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  cpfMasked: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface MailSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: 'starttls' | 'ssl';
  username: string;
  fromName: string;
  fromAddress: string;
  appBaseUrl: string;
  passwordSet: boolean;
}

export interface MailTemplateInfo {
  type: string;
  label: string;
  variables: string[];
  enabled: boolean;
  subject: string;
  body: string;
  custom: boolean;
  defaultSubject: string;
  defaultBody: string;
}

export interface MailLogEntry {
  id: string;
  type: string;
  toAddress: string;
  subject: string;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
  createdAt: string;
}

// Imagens enviadas ficam na própria API (/uploads/...); URLs externas passam como estão.
export function assetUrl(path?: string | null): string {
  if (!path) return '';
  const baseUrl = getApiBaseUrl();
  return path.startsWith('/uploads/') ? `${baseUrl}${path}` : path;
}

export class ApiClient {
  private send(endpoint: string, options: RequestInit = {}, withAuth = true): Promise<Response> {
    const baseUrl = getApiBaseUrl();
    const token = withAuth ? getAuthToken() : null;
    // multipart (upload): o navegador define o Content-Type com o boundary
    const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
    return fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  }

  private handleUnauthorized() {
    // 401 com sessão ativa = token expirado/revogado
    if (typeof window !== 'undefined' && getAuthToken()) {
      logoutUser();
      window.location.assign('/login');
    }
  }

  // Modo tolerante (comportamento histórico): erro vira null
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    try {
      const response = await this.send(endpoint, options);
      if (!response.ok) {
        if (response.status === 401) this.handleUnauthorized();
        console.warn(`[API] Endpoint ${endpoint} retornou status ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[API] Falha de conexão com backend ${getApiBaseUrl()}${endpoint}.`);
      return null;
    }
  }

  // Modo estrito: erro vira ApiError com a mensagem da API
  private async strict<T>(endpoint: string, options: RequestInit = {}, withAuth = true): Promise<T> {
    let response: Response;
    try {
      response = await this.send(endpoint, options, withAuth);
    } catch {
      throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua conexão.');
    }

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const code = body?.code;
      if (code === 'PASSWORD_CHANGE_REQUIRED' && typeof window !== 'undefined') {
        window.location.assign('/trocar-senha');
      } else if (response.status === 401 && withAuth) {
        this.handleUnauthorized();
      }
      const message = Array.isArray(body?.message)
        ? body.message.join(', ')
        : body?.message || `Erro ${response.status}`;
      throw new ApiError(response.status, message, code);
    }
    return body as T;
  }

  // 0. Autenticação & Usuários
  async login(email: string, password: string): Promise<any> {
    // sem token: uma sessão antiga (inclusive com troca de senha pendente) não pode interferir no login
    return this.strict<any>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    );
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
    cpf: string;
    phoneNumber?: string;
    birthDate?: string;
    gender?: string;
    boxOrGym?: string;
    tshirtSize?: string;
  }): Promise<any> {
    return this.strict<any>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(userData) },
      false,
    );
  }

  // Confere se um CPF tem cadastro de atleta (só primeiro nome e CPF mascarado)
  async lookupAthlete(cpf: string): Promise<{ found: boolean; firstName?: string; cpfMasked: string }> {
    return this.strict(`/athletes/lookup?cpf=${encodeURIComponent(cpf)}`);
  }

  async getMe(): Promise<any> {
    return this.strict<any>('/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    return this.strict<any>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Organizadores (Super Admin)
  async listOrganizers(): Promise<OrganizerUser[]> {
    return this.strict<OrganizerUser[]>('/users/organizers');
  }

  // Meu perfil: completa nome, telefone, CPF (uma vez) e dados de atleta
  async updateProfile(data: {
    name?: string;
    phoneNumber?: string;
    cpf?: string;
    birthDate?: string;
    gender?: string;
    tshirtSize?: string;
    boxOrGym?: string;
  }): Promise<any> {
    return this.strict<any>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) });
  }

  // Super admin: atletas (busca e senha temporária)
  async listAthletes(q?: string): Promise<AthleteAdminRow[]> {
    return this.strict<AthleteAdminRow[]>(`/users/athletes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }

  async resetAthletePassword(id: string): Promise<{ user: AthleteAdminRow; temporaryPassword: string }> {
    return this.strict(`/users/athletes/${id}/reset-password`, { method: 'POST' });
  }

  // Recuperação de senha (público)
  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.strict('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, false);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.strict(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify({ token, newPassword }) },
      false,
    );
  }

  // E-mails (super admin)
  async getMailSettings(): Promise<MailSettings> {
    return this.strict<MailSettings>('/mail/settings');
  }

  async saveMailSettings(data: Partial<MailSettings> & { password?: string }): Promise<MailSettings> {
    return this.strict<MailSettings>('/mail/settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  async testMailSettings(): Promise<{ ok: boolean; error?: string }> {
    return this.strict('/mail/settings/test', { method: 'POST' });
  }

  async listMailTemplates(): Promise<MailTemplateInfo[]> {
    return this.strict<MailTemplateInfo[]>('/mail/templates');
  }

  async saveMailTemplate(
    type: string,
    data: { enabled: boolean; subject: string; body: string },
  ): Promise<MailTemplateInfo> {
    return this.strict<MailTemplateInfo>(`/mail/templates/${type}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async resetMailTemplate(type: string): Promise<MailTemplateInfo> {
    return this.strict<MailTemplateInfo>(`/mail/templates/${type}`, { method: 'DELETE' });
  }

  async previewMailTemplate(
    type: string,
    draft: { subject: string; body: string },
  ): Promise<{ subject: string; text: string; html: string }> {
    return this.strict(`/mail/templates/${type}/preview`, { method: 'POST', body: JSON.stringify(draft) });
  }

  async listMailLogs(status?: string): Promise<MailLogEntry[]> {
    return this.strict<MailLogEntry[]>(`/mail/logs${status ? `?status=${status}` : ''}`);
  }

  async resendMailLog(id: string): Promise<{ status: string; error?: string }> {
    return this.strict(`/mail/logs/${id}/resend`, { method: 'POST' });
  }

  async createOrganizer(data: {
    name: string;
    email: string;
    phoneNumber: string;
  }): Promise<{ user: OrganizerUser; temporaryPassword: string }> {
    return this.strict('/users/organizers', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateOrganizer(
    id: string,
    data: { name?: string; email?: string; phoneNumber?: string },
  ): Promise<OrganizerUser> {
    return this.strict<OrganizerUser>(`/users/organizers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async resetOrganizerPassword(id: string): Promise<{ user: OrganizerUser; temporaryPassword: string }> {
    return this.strict(`/users/organizers/${id}/reset-password`, { method: 'POST' });
  }

  // 1. Campeonatos / Eventos
  async listGames(): Promise<any[] | null> {
    return this.request<any[]>('/events');
  }

  async listMyGames(): Promise<any[]> {
    return this.strict<any[]>('/events/mine');
  }

  async getGame(code: string): Promise<any | null> {
    return this.request<any>(`/events/${code}`);
  }

  async createGame(gameData: {
    code: string;
    name: string;
    date?: string;
    description?: string;
    location?: string;
    foto?: string;
    isLowestPointsBetter?: boolean;
    showTime?: boolean;
    showWeight?: boolean;
    showReps?: boolean;
    showScoreRevision?: boolean;
    lanesCount?: number;
    eventType?: string;
    pixKey?: string;
    pixBeneficiary?: string;
  }) {
    return this.strict<any>('/events', {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
  }

  async updateGame(code: string, gameData: any) {
    return this.strict<any>(`/events/${code}`, {
      method: 'PUT',
      body: JSON.stringify(gameData),
    });
  }

  async updateGameStatus(code: string, status: string) {
    return this.strict<any>(`/events/${code}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteGame(code: string) {
    return this.strict<any>(`/events/${code}`, { method: 'DELETE' });
  }

  async uploadGameBanner(code: string, file: File): Promise<{ foto: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.strict<{ foto: string }>(`/events/${code}/banner`, { method: 'POST', body: form });
  }

  async getLeaderboard(code: string): Promise<any | null> {
    return this.request<any>(`/events/${code}/leaderboard`);
  }

  async addGameOrganizer(code: string, userId: string): Promise<OrganizerUser[]> {
    return this.strict<OrganizerUser[]>(`/events/${code}/organizers`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  // Suspende/reativa o organizador só neste campeonato (mantém o vínculo)
  async setGameOrganizerActive(code: string, userId: string, active: boolean): Promise<OrganizerUser[]> {
    return this.strict<OrganizerUser[]>(`/events/${code}/organizers/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
  }

  async removeGameOrganizer(code: string, userId: string): Promise<OrganizerUser[]> {
    return this.strict<OrganizerUser[]>(`/events/${code}/organizers/${userId}`, { method: 'DELETE' });
  }

  // 2. Categorias
  async listCategories(gameCode: string): Promise<any[] | null> {
    return this.request<any[]>(`/events/${gameCode}/categories`);
  }

  async createCategory(gameCode: string, categoryData: any) {
    return this.strict<any>(`/events/${gameCode}/categories`, {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  }

  async updateCategory(gameCode: string, categoryCode: number | string, categoryData: any) {
    return this.strict<any>(`/events/${gameCode}/categories/${categoryCode}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  }

  async deleteCategory(gameCode: string, categoryCode: number | string) {
    return this.strict<any>(`/events/${gameCode}/categories/${categoryCode}`, {
      method: 'DELETE',
    });
  }

  // 3. WODs / Workouts
  async listWorkouts(gameCode: string, categoryId?: number): Promise<any[] | null> {
    const query = categoryId ? `?categoryId=${categoryId}` : '';
    return this.request<any[]>(`/events/${gameCode}/workouts${query}`);
  }

  async createWorkout(gameCode: string, workoutData: any) {
    return this.request<any>(`/events/${gameCode}/workouts`, {
      method: 'POST',
      body: JSON.stringify(workoutData),
    });
  }

  // 4. Inscrições de Atletas
  async listRegistrations(gameCode: string, categoryId?: number): Promise<any[] | null> {
    const query = categoryId ? `?categoryId=${categoryId}` : '';
    return this.request<any[]>(`/events/${gameCode}/registrations${query}`);
  }

  async registerTeam(gameCode: string, registrationData: any) {
    return this.strict<any>(`/events/${gameCode}/registrations`, {
      method: 'POST',
      body: JSON.stringify(registrationData),
    });
  }

  async updateRegistrationStatus(gameCode: string, regCode: number | string, data: { status?: string; check?: boolean; amount?: number }) {
    const cleanRegCode = String(regCode).replace(/\D/g, '');
    return this.strict<any>(`/events/${gameCode}/registrations/${cleanRegCode}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }


  async deleteRegistration(gameCode: string, regCode: number | string) {
    const cleanRegCode = String(regCode).replace(/\D/g, '');
    return this.strict<any>(`/events/${gameCode}/registrations/${cleanRegCode}`, { method: 'DELETE' });
  }

  // 5. Scores
  async submitScore(scoreData: any) {
    const result = await this.strict<any>('/scores', {
      method: 'POST',
      body: JSON.stringify(scoreData),
    });
    return result?.score || scoreData;
  }

  async attachPhoto(scoreCode: number, photo: string, actorName?: string) {
    return this.request<any>(`/scores/${scoreCode}/photo`, {
      method: 'PATCH',
      body: JSON.stringify({ photo, actorName }),
    });
  }

  // 6. Baterias & Raias
  async generateHeats(body: {
    gameCode: string;
    categoryId: number;
    workoutCode: number;
    totalLanes: number;
    startHour: string;
    intervalMinutes: number;
    isFinalSeeding?: boolean;
  }) {
    return this.request<any>('/heats/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async swapLanes(slotIdA: string, slotIdB: string) {
    return this.request<any>('/heats/swap-lanes', {
      method: 'POST',
      body: JSON.stringify({ slotIdA, slotIdB }),
    });
  }

  async getHeats(gameCode: string, workoutCode: number) {
    return this.request<Heat[]>(`/heats/game/${gameCode}/workout/${workoutCode}`);
  }

  async updateHeatStatus(heatId: string, status: string) {
    return this.request<any>(`/heats/${heatId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // 7. Auditoria
  async getAuditLogs(gameCode: string) {
    return this.request<AuditLogEntry[]>(`/audit/game/${gameCode}`);
  }

  // 8. Backup & Sincronização
  async exportBackup() {
    const res = await this.send('/backup/export', { method: 'GET' }, true);
    if (!res.ok) {
      throw new ApiError(res.status, 'Falha ao exportar backup');
    }
    return await res.json();
  }

  async importBackup(data: any) {
    return this.strict<any>('/backup/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }
}

export const apiClient = new ApiClient();


