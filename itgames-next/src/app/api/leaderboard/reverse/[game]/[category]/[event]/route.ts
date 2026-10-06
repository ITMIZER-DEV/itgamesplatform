import { NextResponse } from 'next/server'
import { leaderboardService } from '@/lib/services/leaderboard.service'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

/**
 * @openapi
 * /api/leaderboard/reverse/{game}/{category}/{event}:
 *   post:
 *     summary: Reverte cálculo de um evento específico
 *     description: Remove pontos do evento do leaderboard e marca scores como não calculados
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reversedBy:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cálculo revertido com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro ao reverter cálculo
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ game: string; category: string; event: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { game, category: categoryStr, event: eventStr } = await params
    const category = Number(categoryStr)
    const eventId = Number(eventStr)

    const body = await request.json()
    const reversedBy = body.reversedBy || user.id
    const reason = body.reason

    const result = await leaderboardService.reverseEventCalculation(
      game,
      category,
      eventId,
      reversedBy,
      reason
    )

    return NextResponse.json({
      success: true,
      message: 'Cálculo do evento revertido com sucesso',
      teamsAffected: result.teamsAffected,
      pointsRemoved: result.pointsRemoved
    })
  } catch (error: any) {
    console.error('Error reversing event calculation:', error)
    return NextResponse.json(
      { error: 'Erro ao reverter cálculo', details: error.message },
      { status: 500 }
    )
  }
}
