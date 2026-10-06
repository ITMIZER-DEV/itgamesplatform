import { NextResponse } from 'next/server'
import { leaderboardService } from '@/lib/services/leaderboard.service'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

/**
 * @openapi
 * /api/score/rank/{game}/{category}/{event}:
 *   post:
 *     summary: Executa o processo de rankeamento para um evento específico
 *     description: Calcula ranking com Dense Rank, inclui WO automático para quem não participou
 *     parameters:
 *       - in: path
 *         name: game
 *         required: true
 *       - in: path
 *         name: category
 *         required: true
 *       - in: path
 *         name: event
 *         required: true
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ game: string, category: string, event: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { game, category: categoryStr, event: eventStr } = await params
    const categoryId = Number(categoryStr)
    const idEvent = Number(eventStr)

    // Usar o novo serviço de leaderboard com WO
    const result = await leaderboardService.confirmCalculation(
      game,
      categoryId,
      idEvent,
      user.id
    )

    return NextResponse.json({
      success: true,
      message: 'Leaderboard gerado com sucesso (incluindo WO)',
      teamsAffected: result.teamsAffected
    })
  } catch (error: any) {
    console.error('Error generating ranking:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar ranking', details: error.message },
      { status: 500 }
    )
  }
}
