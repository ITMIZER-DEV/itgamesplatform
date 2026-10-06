export interface Score {
  code?: string | number
  rank?: number
  time?: string | null
  weight?: string | number | null
  reps?: string | number | null
  photo?: string | null
  isWO?: boolean | null
  point?: number | null
  codeTeam: number
  idEvent: number
  Judge?: { name: string }
  registration: {
    code: number
    team: string
    number?: string
    athletes: Array<{ name: string; cpf?: string; phonenumber?: string; code: number }>
  }
}

export interface LeaderboardEntry {
  Rank: number
  points: number
  registration: {
    team: string
    athletes: Array<{ name: string }>
    scores: Array<{
      eventRef: { title: string }
      weight?: string
      reps?: string
      time?: string
      rank: number
      point: number
      isWO?: boolean
    }>
  }
}

export interface LeaderboardHistory {
  id: number
  game: string
  category: number
  teamCode: number
  eventId: number
  pointsAdded: number
  totalPoints: number
  rank: number
  calculatedAt: Date
  calculatedBy?: string
  reversed: boolean
  reversedAt?: Date
  reversedBy?: string
}

export interface EventCalculation {
  id: number
  game: string
  category: number
  eventId: number
  operation: 'CALCULATE' | 'REVERSE'
  executedAt: Date
  executedBy?: string
  affectedTeams: number
}
