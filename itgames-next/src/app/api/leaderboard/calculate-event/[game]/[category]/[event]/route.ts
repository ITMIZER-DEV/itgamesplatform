import { NextRequest, NextResponse } from 'next/server'
import { rankingService } from '@/lib/services/ranking.service'
import { leaderboardService } from '@/lib/services/leaderboard.service'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ game: string; category: string; event: string }>
}

/**
 * GET /api/leaderboard/calculate-event/[game]/[category]/[event]
 * Gera preview do cálculo de um evento individual
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { game, category, event } = await context.params
    const categoryNum = parseInt(category)
    const eventId = parseInt(event)

    if (isNaN(categoryNum) || isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros inválidos' },
        { status: 400 }
      )
    }

    // Calcular ranking do evento (sem salvar)
    const result = await rankingService.calculateEventRanking(game, categoryNum, eventId)

    return NextResponse.json({
      success: true,
      completed: result.completed,
      walkOver: result.walkOver,
      stats: result.stats
    })
  } catch (error) {
    console.error('❌ Error calculating event preview:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao calcular preview do evento'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/leaderboard/calculate-event/[game]/[category]/[event]
 * Calcula e grava um evento individual no leaderboard
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { game, category, event } = await context.params
    const categoryNum = parseInt(category)
    const eventId = parseInt(event)

    if (isNaN(categoryNum) || isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros inválidos' },
        { status: 400 }
      )
    }

    // Calcular e salvar o evento
    const result = await leaderboardService.confirmCalculation(
      game,
      categoryNum,
      eventId,
      user.id
    )

    return NextResponse.json({
      success: true,
      message: 'Evento calculado e gravado com sucesso',
      teamsAffected: result.teamsAffected
    })
  } catch (error) {
    console.error('❌ Error calculating and saving event:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao calcular e gravar evento'
      },
      { status: 500 }
    )
  }
}
