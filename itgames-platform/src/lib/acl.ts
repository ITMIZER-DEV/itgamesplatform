export type UserRoleType = 'SUPER_ADMIN' | 'ORGANIZER' | 'JUDGE' | 'ATHLETE' | 'GUEST';

export interface UserSession {
  id?: string;
  name?: string;
  email?: string;
  role: UserRoleType;
  token?: string;
  mustChangePassword?: boolean;
}

interface StoredSession {
  token: string;
  user: { id: string; name: string; email: string; role: UserRoleType; mustChangePassword?: boolean };
}

const SESSION_KEY = 'itgames_session';
// Chaves antigas, removidas no logout e ignoradas na leitura
const LEGACY_KEYS = [
  'itgames_user_role',
  'itgames_user_email',
  'itgames_user_name',
  'itgames_user_id',
  'itgames_auth_token',
  'itgames_current_user',
  'itgames_jwt_token',
];

function decodeExp(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payload));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

function readStored(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSession;
    const exp = decodeExp(stored.token);
    if (!exp || exp * 1000 <= Date.now()) return null;
    return stored;
  } catch {
    return null;
  }
}

export function saveSession(res: { accessToken: string; user: StoredSession['user'] }): void {
  if (typeof window === 'undefined') return;
  const stored: StoredSession = {
    token: res.accessToken,
    user: {
      id: res.user.id,
      name: res.user.name,
      email: res.user.email,
      role: res.user.role,
      mustChangePassword: !!res.user.mustChangePassword,
    },
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  window.dispatchEvent(new Event('itgames_auth_changed'));
}

export function getAuthToken(): string | null {
  return readStored()?.token ?? null;
}

export function getCurrentUserSession(): UserSession {
  const stored = readStored();
  if (!stored) return { role: 'GUEST' };
  return {
    id: stored.user.id,
    name: stored.user.name,
    email: stored.user.email,
    role: stored.user.role,
    token: stored.token,
    mustChangePassword: stored.user.mustChangePassword,
  };
}

export function logoutUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new Event('itgames_auth_changed'));
}

export function homeForRole(role: UserRoleType): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ORGANIZER':
      return '/admin';
    case 'JUDGE':
      return '/judge';
    case 'ATHLETE':
      return '/athlete';
    default:
      return '/login';
  }
}

export function hasPermission(role: UserRoleType, resource: 'admin' | 'judge' | 'athlete' | 'heats' | 'sumulas' | 'superadmin' | 'public'): boolean {
  if (role === 'SUPER_ADMIN') return true;

  switch (resource) {
    case 'public':
      return true;
    case 'athlete':
      return role === 'ATHLETE' || role === 'SUPER_ADMIN' || role === 'ORGANIZER';
    case 'judge':
      return role === 'JUDGE' || role === 'ORGANIZER' || role === 'SUPER_ADMIN';
    case 'heats':
    case 'sumulas':
    case 'admin':
      return role === 'ORGANIZER' || role === 'SUPER_ADMIN';
    case 'superadmin':
      return role === 'SUPER_ADMIN';
    default:
      return false;
  }
}
