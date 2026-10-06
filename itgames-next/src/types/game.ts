export interface Game {
  code: string
  name: string
  date: string
  description?: string
  location?: string
  status: 'Ativo' | 'Inativo' | 'New' | 'Cancelado'
  foto?: string
  isLowestPointsBetter: boolean
  showTime: boolean
  showWeight?: boolean
  showReps?: boolean
  showScoreRevision?: boolean
  categories?: any[]
}

export interface Category {
  code: string | number
  name: string
  description?: string
  standards?: string
  amount: number
  maxAthlete: number
  gamesId: string
  events?: GameEvent[]
  workouts?: Workout[]
}

export interface GameEvent {
  idEvent: number
  title: string
  game: string
  category: string | number
  workout: string
  status?: boolean
  sumulaTemplate?: string
}

export interface Workout {
  code: string
  type: 'time' | 'weight' | 'reps'
  timeCap?: string
  description?: string
}
