export interface Athlete {
  code?: number
  name: string
  cpf?: string
  phonenumber?: string
}

export interface TeamRegistration {
  gameId: string
  team: string
  categoryId: number
  amount: number
  athletes: Athlete[]
}

export interface Registration {
  code: string | number
  number: string
  game: string
  categoryId: number
  team: string
  amount: number
  status: string
  category: string // Nome da categoria
  categoryRef?: {
    code: number | string
    name: string
    description?: string
    standards?: string
    amount?: string
    maxAthlete?: number
    gamesId?: string
  }
  athletes?: Athlete[]
}
