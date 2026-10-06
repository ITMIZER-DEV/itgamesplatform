import axios from 'axios'

export const api = axios.create({
  baseURL: (process.env.NEXT_PUBLIC_API_BASE_URL || '/api').replace(/[ \"]/g, ''),
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': process.env.NEXT_PUBLIC_TENANT_ID ?? '1',
  },
})

export const gamesApi = {
  list: () => api.get('games'),
  getByCode: (code: string) => api.get(`games/${code}`),
  create: (data: unknown) => api.post('games', data),
  update: (code: string, data: unknown) => api.patch(`games/${code}`, data),
}

export const leaderboardApi = {
  get: (gameCode: string, categoryCode: string) =>
    api.get(`leaderboard/${gameCode}/${categoryCode}`),
}

export const eventsApi = {
  list: (gameCode: string, categoryCode: string) =>
    api.get(`events/${gameCode}/${categoryCode}`),
  getClosed: (categoryCode: string, eventId: string | number) =>
    api.get(`events/closed/${categoryCode}/${eventId}`),
}

export const scoresApi = {
  list: (gameCode: string, categoryCode: string, eventId: string | number) =>
    api.get(`score/${gameCode}/${categoryCode}/${eventId}`),
  getByCode: (code: string) => api.get(`score/code/${code}`),
  delete: (code: string) => api.delete(`score/code/${code}`),
  submit: (data: unknown) => api.post('score', data),
}

export const registrationApi = {
  list: (gameCode: string) => api.get(`game/register?game=${gameCode}`),
  getByCode: (regCode: string, gameCode: string) => api.get(`game/register/${regCode}?game=${gameCode}`),
  register: (data: unknown) => api.post('game/register', data),
}

export const categoryApi = {
  get: (gamesId: string, categoryCode: string) =>
    api.get(`category/${gamesId}/${categoryCode}`),
  create: (data: unknown) => api.post('category', data),
  update: (code: string, data: unknown) => api.patch(`category/${code}`, data),
}

export const workoutsApi = {
  list: (gameCode: string) => api.get(`workout/${gameCode}`),
  create: (data: unknown) => api.post('workout', data),
  delete: (id: string) => api.delete(`workout/${id}`),
}

export const judgesApi = {
  list: (gameId: string) => api.get(`judges/${gameId}`),
  listByPerson: (idPerson: string) => api.get(`judges?idPerson=${idPerson}`),
}

export const authApi = {
  login: (email: string, token?: string) =>
    api.post<{ idPerson?: string; role?: string; message?: string }>('login', { email, token }),
}
