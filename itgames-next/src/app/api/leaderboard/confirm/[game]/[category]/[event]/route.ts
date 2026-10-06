import { NextResponse } from 'next/server'
import { leaderboardService } from '@/lib/services/leaderboard.service'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

/**
 * @openapi
 * /api/leaderboard/confirm/{game}/{category}/{event}:
 *   post:
 *     summary: Confirma e salva cálculo do leaderboard para um evento
 *     description: Persiste no banco o ranking calculado após confirmação do usuário
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
 *               calculatedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cálculo confirmado e salvo com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro ao confirmar cálculo
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
    const calculatedBy = body.calculatedBy || user.id

    const result = await leaderboardService.confirmCalculation(
      game,
      category,
      eventId,
      calculatedBy
    )

    return NextResponse.json({
      success: true,
      message: 'Leaderboard calculado e salvo com sucesso',
      teamsAffected: result.teamsAffected
    })
  } catch (error: any) {
    console.error('Error confirming leaderboard:', error)
    return NextResponse.json(
      { error: 'Erro ao confirmar cálculo', details: error.message },
      { status: 500 }
    )
  }
}
