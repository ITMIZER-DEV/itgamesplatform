import { prisma } from '@/lib/prisma'
import { rankingService, type RankedScore } from './ranking.service'
import type { Prisma } from '@prisma/client'

export interface LeaderboardPreview {
  teams: TeamLeaderboardEntry[]
  metadata: {
    totalTeams: number
    eventsCalculated: number
    lastUpdate: Date | null
    calculatedEvents?: Array<{
      eventId: number
      eventTitle: string
      canReverse: boolean
    }>
  }
}

export interface TeamLeaderboardEntry {
  teamCode: number
  teamName: string
  athletes: string[]
  events: EventScore[]
  totalPoints: number
  position: number
}

export interface EventScore {
  eventId: number
  eventTitle: string
  rank: number
  points: number
  result: string
  isWO: boolean
}

export class LeaderboardService {
  /**
   * Gera preview do leaderboard sem salvar no banco
   */
  async generatePreview(game: string, category: number): Promise<LeaderboardPreview> {
    // 1. Buscar configuração do game para saber a ordem de pontuação
    const gameData = await prisma.game.findUnique({
      where: { code: game },
      select: { isLowestPointsBetter: true }
    })

    const isLowest = gameData?.isLowestPointsBetter ?? false

    // 2. Buscar todos os eventos da categoria para garantir que as colunas apareçam no preview
    const events = await prisma.event.findMany({
      where: { game, category },
      orderBy: { idEvent: 'asc' }
    })

    // 3. Buscar todos os registros da categoria
    const registrations = await prisma.registration.findMany({
      where: {
        gameCode: game,
        categoryId: category
      },
      include: {
        athletes: { select: { name: true } },
        scores: {
          where: { status: true },
          include: {
            eventRef: { select: { title: true, idEvent: true } }
          }
        }
      }
    })

    // 4. Construir leaderboard
    const teams: TeamLeaderboardEntry[] = registrations.map(reg => {
      // Criar mapa de scores para acesso rápido pelas colunas
      const scoreMap = new Map(reg.scores.map(s => [s.idEvent, s]))

      const eventScores: EventScore[] = events.map(event => {
        const score = scoreMap.get(event.idEvent)
        if (score) {
          return {
            eventId: score.idEvent,
            eventTitle: event.title,
            rank: score.rank ?? 0,
            points: score.point ?? 0,
            result: this.formatResult(score.time, score.weight, score.reps, score.isWO),
            isWO: score.isWO ?? false
          }
        }

        // Se não tem score, retorna vazio para a coluna
        return {
          eventId: event.idEvent,
          eventTitle: event.title,
          rank: 0,
          points: 0,
          result: '-',
          isWO: false
        }
      })

      const totalPoints = eventScores.reduce((sum, e) => sum + e.points, 0)

      return {
        teamCode: reg.code,
        teamName: reg.team,
        athletes: reg.athletes.map(a => a.name),
        events: eventScores,
        totalPoints,
        position: 0 // Será calculado depois
      }
    })

    // 5. Ordenar baseado na configuração (ascendente ou descendente)
    teams.sort((a, b) => isLowest ? a.totalPoints - b.totalPoints : b.totalPoints - a.totalPoints)

    let currentPosition = 1
    let previousPoints: number | null = null

    teams.forEach(team => {
      if (previousPoints !== null && team.totalPoints !== previousPoints) {
        currentPosition++
      }
      team.position = currentPosition
      previousPoints = team.totalPoints
    })

    // 6. Buscar eventos já calculados com informações completas
    const eventCalculations = await prisma.eventCalculation.findMany({
      where: {
        game,
        category,
        operation: 'CALCULATE'
      },
      orderBy: { eventId: 'asc' },
      distinct: ['eventId']
    })

    // 7. Buscar informações dos eventos e verificar se podem ser revertidos
    const calculatedEventsInfo = await Promise.all(
      eventCalculations.map(async (calc) => {
        const event = events.find(e => e.idEvent === calc.eventId)

        // Verificar se tem histórico não revertido
        const hasHistory = await prisma.leaderboardHistory.count({
          where: {
            game,
            category,
            eventId: calc.eventId,
            reversed: false
          }
        })

        return {
          eventId: calc.eventId,
          eventTitle: event?.title || `Evento ${calc.eventId}`,
          canReverse: hasHistory > 0
        }
      })
    )

    const lastCalculation = await prisma.eventCalculation.findFirst({
      where: { game, category },
      orderBy: { executedAt: 'desc' }
    })

    return {
      teams,
      metadata: {
        totalTeams: teams.length,
        eventsCalculated: eventCalculations.length,
        lastUpdate: lastCalculation?.executedAt ?? null,
        calculatedEvents: calculatedEventsInfo
      }
    }
  }

  /**
   * Confirma e salva cálculo do leaderboard
   */
  async confirmCalculation(
    game: string,
    category: number,
    eventId: number,
    executedBy?: string
  ): Promise<{ success: boolean; teamsAffected: number }> {
    // 1. Calcular ranking do evento
    const ranking = await rankingService.calculateEventRanking(game, category, eventId)

    // 2. Buscar leaderboards existentes ANTES da transação (para evitar timeout)
    const existingLeaderboards = await prisma.leaderboard.findMany({
      where: { game, category },
      select: { teamCode: true, points: true }
    })
    const leaderboardMap = new Map(
      existingLeaderboards.map(lb => [lb.teamCode, lb.points ?? 0])
    )

    // 3. Salvar em transação com timeout maior
    const teamsAffected = await prisma.$transaction(async (tx) => {
      let affected = 0
      const allScores = [...ranking.completed, ...ranking.walkOver]

      // 3.1. Processar TODOS os scores
      for (const score of allScores) {
        const isWO = 'isWO' in score && score.isWO

        // Buscar score existente
        const existingScore = await tx.score.findFirst({
          where: { codeTeam: score.codeTeam, idEvent: eventId, game },
          select: { code: true }
        })

        if (existingScore) {
          // Atualizar
          await tx.score.update({
            where: { code: existingScore.code },
            data: {
              rank: score.rank,
              point: score.point,
              isWO,
              status: true,
              time: score.time || null,
              weight: score.weight || null,
              reps: score.reps || null
            }
          })
        } else {
          // Criar
          await tx.score.create({
            data: {
              codeTeam: score.codeTeam,
              idEvent: eventId,
              game,
              category,
              rank: score.rank,
              point: score.point,
              isWO,
              status: true,
              time: score.time || null,
              weight: score.weight || null,
              reps: score.reps || null
            }
          })
        }

        // 3.2. Atualizar/criar leaderboard (usando cache)
        const previousPoints = leaderboardMap.get(score.codeTeam) ?? 0
        const newTotal = previousPoints + score.point

        await tx.leaderboard.upsert({
          where: {
            game_category_teamCode: { game, category, teamCode: score.codeTeam }
          },
          create: {
            game,
            category,
            teamCode: score.codeTeam,
            points: score.point,
            position: 0
          },
          update: {
            points: { increment: score.point }
          }
        })

        // 3.3. Registrar histórico
        await tx.leaderboardHistory.create({
          data: {
            game,
            category,
            teamCode: score.codeTeam,
            eventId,
            pointsAdded: score.point,
            totalPoints: newTotal,
            rank: score.rank,
            calculatedBy: executedBy
          }
        })

        affected++
      }

      // 3.4. Registrar cálculo e marcar evento
      await Promise.all([
        tx.eventCalculation.create({
          data: {
            game,
            category,
            eventId,
            operation: 'CALCULATE',
            executedBy,
            affectedTeams: affected
          }
        }),
        tx.event.update({
          where: { idEvent_game: { idEvent: eventId, game } },
          data: { status: true }
        })
      ])

      return affected
    }, {
      timeout: 60000 // 60 segundos
    })

    // 4. Recalcular posições do leaderboard
    await rankingService.recalculateLeaderboardPositions(game, category)

    return { success: true, teamsAffected }
  }

  /**
   * Reverte cálculo de um evento específico
   */
  async reverseEventCalculation(
    game: string,
    category: number,
    eventId: number,
    reversedBy?: string,
    reason?: string
  ): Promise<{ success: boolean; teamsAffected: number; pointsRemoved: number }> {
    let teamsAffected = 0
    let pointsRemoved = 0

    await prisma.$transaction(async (tx) => {
      // 1. Buscar histórico do evento
      const history = await tx.leaderboardHistory.findMany({
        where: {
          game,
          category,
          eventId,
          reversed: false
        }
      })

      // 2. Reverter cada entrada
      for (const entry of history) {
        // 2.1. Subtrair pontos do leaderboard
        const leaderboardEntry = await tx.leaderboard.findUnique({
          where: {
            game_category_teamCode: {
              game,
              category,
              teamCode: entry.teamCode
            }
          }
        })

        if (leaderboardEntry) {
          const newPoints = (leaderboardEntry.points ?? 0) - entry.pointsAdded

          // Se os pontos ficarem zero ou negativos, deletar a entrada
          if (newPoints <= 0) {
            await tx.leaderboard.delete({
              where: { id: leaderboardEntry.id }
            })
          } else {
            // Caso contrário, apenas subtrair os pontos
            await tx.leaderboard.update({
              where: { id: leaderboardEntry.id },
              data: {
                points: newPoints
              }
            })
          }
        }

        // 2.2. Marcar histórico como revertido
        await tx.leaderboardHistory.update({
          where: { id: entry.id },
          data: {
            reversed: true,
            reversedAt: new Date(),
            reversedBy
          }
        })

        pointsRemoved += entry.pointsAdded
        teamsAffected++
      }

      // 3. Remover ranks e pontos dos scores
      await tx.score.updateMany({
        where: {
          game,
          category,
          idEvent: eventId
        },
        data: {
          rank: null,
          point: null,
          status: false
        }
      })

      // 4. Deletar scores WO criados automaticamente
      await tx.score.deleteMany({
        where: {
          game,
          category,
          idEvent: eventId,
          isWO: true
        }
      })

      // 5. Registrar reversão
      await tx.eventCalculation.create({
        data: {
          game,
          category,
          eventId,
          operation: 'REVERSE',
          executedBy: reversedBy,
          affectedTeams: teamsAffected
        }
      })

      // 6. Marcar evento como não calculado
      await tx.event.update({
        where: { idEvent_game: { idEvent: eventId, game } },
        data: { status: false }
      })
    })

    // 7. Recalcular posições do leaderboard
    await rankingService.recalculateLeaderboardPositions(game, category)

    return { success: true, teamsAffected, pointsRemoved }
  }

  /**
   * Limpa TODOS os cálculos de uma categoria (reset completo)
   */
  async clearAllCalculations(
    game: string,
    category: number,
    clearedBy?: string
  ): Promise<{ success: boolean; eventsCleared: number; teamsAffected: number }> {
    let eventsCleared = 0
    let teamsAffected = 0

    await prisma.$transaction(async (tx) => {
      // 1. Buscar todos os eventos calculados da categoria
      const eventCalculations = await tx.eventCalculation.findMany({
        where: {
          game,
          category,
          operation: 'CALCULATE'
        },
        distinct: ['eventId']
      })

      eventsCleared = eventCalculations.length

      // 2. Deletar TODAS as entradas do leaderboard da categoria
      const deletedLeaderboard = await tx.leaderboard.deleteMany({
        where: {
          game,
          category
        }
      })

      teamsAffected = deletedLeaderboard.count

      // 3. Marcar TODO o histórico como revertido
      await tx.leaderboardHistory.updateMany({
        where: {
          game,
          category,
          reversed: false
        },
        data: {
          reversed: true,
          reversedAt: new Date(),
          reversedBy: clearedBy
        }
      })

      // 4. Remover ranks e pontos de TODOS os scores da categoria
      await tx.score.updateMany({
        where: {
          game,
          category
        },
        data: {
          rank: null,
          point: null,
          status: false
        }
      })

      // 5. Deletar TODOS os scores WO da categoria
      await tx.score.deleteMany({
        where: {
          game,
          category,
          isWO: true
        }
      })

      // 6. Marcar todos os eventos como não calculados
      await tx.event.updateMany({
        where: {
          game,
          category
        },
        data: {
          status: false
        }
      })

      // 7. Registrar operação de limpeza
      await tx.eventCalculation.create({
        data: {
          game,
          category,
          eventId: 0, // 0 indica limpeza completa
          operation: 'CLEAR_ALL',
          executedBy: clearedBy || 'admin',
          affectedTeams: teamsAffected
        }
      })
    }, {
      timeout: 60000 // 60 segundos
    })

    return { success: true, eventsCleared, teamsAffected }
  }

  /**
   * Busca histórico de um time específico
   */
  async getTeamHistory(game: string, category: number, teamCode: number) {
    const history = await prisma.leaderboardHistory.findMany({
      where: {
        game,
        category,
        teamCode
      },
      orderBy: { calculatedAt: 'asc' }
    })

    // Buscar títulos dos eventos
    const eventIds = [...new Set(history.map(h => h.eventId))]
    const events = await prisma.event.findMany({
      where: {
        game,
        idEvent: { in: eventIds }
      },
      select: { idEvent: true, title: true }
    })

    const eventMap = new Map(events.map(e => [e.idEvent, e.title]))

    return history.map(h => ({
      eventId: h.eventId,
      eventTitle: eventMap.get(h.eventId) ?? `Event ${h.eventId}`,
      pointsAdded: h.pointsAdded,
      totalAfter: h.totalPoints,
      rank: h.rank,
      calculatedAt: h.calculatedAt,
      reversed: h.reversed,
      reversedAt: h.reversedAt
    }))
  }

  /**
   * Atualiza entrada do leaderboard e registra histórico
   */
  private async updateLeaderboardEntry(
    tx: Prisma.TransactionClient,
    game: string,
    category: number,
    teamCode: number,
    eventId: number,
    pointsToAdd: number,
    rank: number,
    executedBy?: string
  ) {
    // 1. Buscar pontos anteriores do time
    const existingEntry = await tx.leaderboard.findUnique({
      where: {
        game_category_teamCode: {
          game,
          category,
          teamCode
        }
      }
    })

    const previousTotal = existingEntry?.points ?? 0
    const newTotal = previousTotal + pointsToAdd

    // 2. Upsert no leaderboard
    await tx.leaderboard.upsert({
      where: {
        game_category_teamCode: {
          game,
          category,
          teamCode
        }
      },
      create: {
        game,
        category,
        teamCode,
        points: pointsToAdd,
        position: 0 // Será recalculado depois
      },
      update: {
        points: {
          increment: pointsToAdd
        }
      }
    })

    // 3. Registrar no histórico
    await tx.leaderboardHistory.create({
      data: {
        game,
        category,
        teamCode,
        eventId,
        pointsAdded: pointsToAdd,
        totalPoints: newTotal,
        rank,
        calculatedBy: executedBy
      }
    })
  }

  /**
   * Formata resultado para exibição
   */
  private formatResult(
    time?: string | null,
    weight?: string | null,
    reps?: string | null,
    isWO?: boolean | null
  ): string {
    if (isWO) return 'WO'
    if (time) return time
    if (weight && reps) return `${weight}kg / ${reps} reps`
    if (weight) return `${weight}kg`
    if (reps) return `${reps} reps`
    return '-'
  }
}

export const leaderboardService = new LeaderboardService()
