import { prisma } from '@/lib/prisma'
import type { Score, Registration } from '@prisma/client'

export interface RankedScore {
  code?: number
  codeTeam: number
  teamNumber?: string
  teamName?: string
  idEvent: number
  game: string
  category: number
  time?: string | null
  weight?: string | null
  reps?: string | null
  rank: number
  point: number
  isWO: boolean
  judge?: string | null
  dateScore?: string | null
  status?: boolean | null
}

export interface RankingResult {
  completed: RankedScore[]
  walkOver: RankedScore[]
  stats: {
    totalRegistrations: number
    participated: number
    walkOver: number
  }
}

export class RankingService {
  /**
   * Calcula ranking completo de um evento incluindo WO
   */
  async calculateEventRanking(
    game: string,
    category: number,
    eventId: number
  ): Promise<RankingResult> {
    // 1. Buscar TODOS os inscritos na categoria
    const allRegistrations = await prisma.registration.findMany({
      where: {
        gameCode: game,
        categoryId: category,
        status: { not: 'cancelled' }
      }
    })

    // 2. Buscar scores existentes do evento
    const scores = await prisma.score.findMany({
      where: {
        game,
        category,
        idEvent: eventId
      }
    })

    // 3. Identificar quem fez e quem não fez
    const teamsWithScores = new Set(scores.map(s => s.codeTeam))
    const teamsWO = allRegistrations.filter(
      reg => !teamsWithScores.has(reg.code)
    )

    // 4. Criar Maps de nomes e números dos times
    const teamNames = new Map(allRegistrations.map(reg => [reg.code, reg.team]))
    const teamNumbers = new Map(allRegistrations.map(reg => [reg.code, reg.number]))

    // 5. Rankear quem fez a prova (Dense Rank)
    const rankedScores = await this.applyDenseRank(scores, game, category)

    // Adicionar nomes e números dos times aos scores ranqueados
    rankedScores.forEach(score => {
      score.teamName = teamNames.get(score.codeTeam)
      score.teamNumber = teamNumbers.get(score.codeTeam) || undefined
    })

    // 6. Determinar posição WO (último + 1)
    const lastPosition = rankedScores.length > 0
      ? rankedScores[rankedScores.length - 1].rank
      : 0
    const woPosition = lastPosition + 1

    // 7. Buscar pontuação para posição WO
    const woPoints = await this.getPointsForPosition(game, category, woPosition)

    // 8. Criar registros WO
    const woEntries: RankedScore[] = teamsWO.map(team => ({
      codeTeam: team.code,
      teamNumber: team.number || undefined,
      teamName: team.team,
      idEvent: eventId,
      game,
      category,
      rank: woPosition,
      point: woPoints,
      isWO: true,
      time: null,
      weight: null,
      reps: null,
      status: true
    }))

    return {
      completed: rankedScores,
      walkOver: woEntries,
      stats: {
        totalRegistrations: allRegistrations.length,
        participated: rankedScores.length,
        walkOver: woEntries.length
      }
    }
  }

  /**
   * Aplica Dense Rank (empates recebem mesma posição)
   */
  private async applyDenseRank(
    scores: Score[],
    game: string,
    category: number
  ): Promise<RankedScore[]> {
    // Ordenar scores por critérios (time asc, weight desc, reps desc)
    const sorted = this.sortScores(scores)

    let currentRank = 1
    let previousScore: Score | null = null

    const rankedScores: RankedScore[] = []

    for (const score of sorted) {
      // Se não for o primeiro e não estiver empatado, incrementa rank
      if (previousScore && !this.isTied(score, previousScore)) {
        currentRank++
      }

      // Buscar pontuação para esta posição
      const points = await this.getPointsForPosition(game, category, currentRank)

      rankedScores.push({
        ...score,
        rank: currentRank,
        point: points,
        isWO: false
      })

      previousScore = score
    }

    return rankedScores
  }

  /**
   * Ordena scores por critérios
   * - WODs por TEMPO: menor tempo ganha
   *   - Se tiver REPS: tempo + reps (reps faltantes = penalidade)
   * - WODs por PESO/REPS: maior peso/reps ganha
   */
  private sortScores(scores: Score[]): Score[] {
    return [...scores].sort((a, b) => {
      // CASO 1: WOD por TEMPO (menor tempo ganha)
      if (a.time && b.time) {
        const timeCompare = this.compareTime(a.time, b.time)
        // Se tempos diferentes, o menor ganha
        if (timeCompare !== 0) return timeCompare

        // Se tempos iguais e ambos têm REPS:
        // REPS = trabalho NÃO completado (penalidade)
        // Quanto MENOS reps, MELHOR (menos trabalho faltou)
        const repsA = parseInt(a.reps || '0')
        const repsB = parseInt(b.reps || '0')

        if (repsA !== repsB) {
          return repsA - repsB // MENOR reps ganha (menos penalidade)
        }

        return 0
      }

      // Se só um tem tempo, quem tem tempo é melhor
      if (a.time && !b.time) return -1
      if (!a.time && b.time) return 1

      // CASO 2: WOD por PESO (maior peso ganha)
      if (a.weight && b.weight) {
        const weightCompare = this.compareWeight(b.weight, a.weight) // invertido (maior melhor)
        // Se pesos diferentes, o maior ganha
        if (weightCompare !== 0) return weightCompare

        // Se pesos iguais, usa REPS como tiebreak (maior reps melhor)
        const repsA = parseInt(a.reps || '0')
        const repsB = parseInt(b.reps || '0')

        if (repsA !== repsB) {
          return repsB - repsA // Maior reps ganha
        }

        return 0
      }

      // Se só um tem peso, quem tem peso é melhor
      if (a.weight && !b.weight) return -1
      if (!a.weight && b.weight) return 1

      // CASO 3: WOD por REPS (maior reps ganha)
      if (a.reps && b.reps) {
        return this.compareReps(b.reps, a.reps) // invertido (maior reps melhor)
      }

      // Se só um tem reps, quem tem reps é melhor
      if (a.reps && !b.reps) return -1
      if (!a.reps && b.reps) return 1

      return 0
    })
  }

  /**
   * Compara dois tempos no formato "MM:SS" ou "HH:MM:SS"
   */
  private compareTime(time1: string, time2: string): number {
    const seconds1 = this.timeToSeconds(time1)
    const seconds2 = this.timeToSeconds(time2)
    return seconds1 - seconds2
  }

  /**
   * Converte tempo "MM:SS" ou "HH:MM:SS" para segundos
   */
  private timeToSeconds(time: string): number {
    const parts = time.split(':').map(Number)
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return 0
  }

  /**
   * Compara dois pesos (string para número)
   */
  private compareWeight(weight1: string, weight2: string): number {
    const w1 = parseFloat(weight1) || 0
    const w2 = parseFloat(weight2) || 0
    return w1 - w2
  }

  /**
   * Compara duas repetições (string para número)
   */
  private compareReps(reps1: string, reps2: string): number {
    const r1 = parseInt(reps1) || 0
    const r2 = parseInt(reps2) || 0
    return r1 - r2
  }

  /**
   * Verifica se dois scores estão empatados
   */
  private isTied(score1: Score, score2: Score): boolean {
    return (
      score1.time === score2.time &&
      score1.weight === score2.weight &&
      score1.reps === score2.reps
    )
  }

  /**
   * Busca pontuação para uma posição específica
   */
  private async getPointsForPosition(
    game: string,
    category: number,
    position: number
  ): Promise<number> {
    const pointData = await prisma.points.findFirst({
      where: {
        game,
        category,
        position
      }
    })

    return pointData?.points ?? 0
  }

  /**
   * Recalcula todas as posições do leaderboard após mudanças
   */
  async recalculateLeaderboardPositions(
    game: string,
    category: number
  ): Promise<void> {
    // 1. Buscar configuração do game para saber a ordem de pontuação
    const gameData = await prisma.game.findUnique({
      where: { code: game },
      select: { isLowestPointsBetter: true }
    })

    const order = gameData?.isLowestPointsBetter ? 'asc' : 'desc'

    // 2. Buscar todos os times com suas pontuações totais na ordem correta
    const leaderboard = await prisma.leaderboard.findMany({
      where: { game, category },
      orderBy: { points: order }
    })

    // Aplicar Dense Rank nas posições
    let currentPosition = 1
    let previousPoints: number | null = null

    for (const entry of leaderboard) {
      if (previousPoints !== null && entry.points !== previousPoints) {
        currentPosition++
      }

      await prisma.leaderboard.update({
        where: { id: entry.id },
        data: { position: currentPosition }
      })

      previousPoints = entry.points ?? null
    }
  }
}

export const rankingService = new RankingService()
