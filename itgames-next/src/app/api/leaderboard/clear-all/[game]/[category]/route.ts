import { NextRequest, NextResponse } from 'next/server'
import { leaderboardService } from '@/lib/services/leaderboard.service'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ game: string; category: string }>
}

/**
 * POST /api/leaderboard/clear-all/[game]/[category]
 * Limpa TODOS os cálculos de uma categoria (reset completo)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { game, category } = await context.params
    const categoryNum = parseInt(category)

    if (isNaN(categoryNum)) {
      return NextResponse.json(
        { success: false, error: 'Categoria inválida' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const clearedBy = body.clearedBy || user.id

    // Limpar todos os cálculos
    const result = await leaderboardService.clearAllCalculations(
      game,
      categoryNum,
      clearedBy
    )

    return NextResponse.json({
      success: true,
      message: 'Todos os cálculos foram limpos com sucesso',
      eventsCleared: result.eventsCleared,
      teamsAffected: result.teamsAffected
    })
  } catch (error) {
    console.error('❌ Error clearing all calculations:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao limpar cálculos'
      },
      { status: 500 }
    )
  }
}
