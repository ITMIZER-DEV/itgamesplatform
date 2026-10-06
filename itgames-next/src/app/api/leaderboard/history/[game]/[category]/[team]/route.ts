import { NextResponse } from 'next/server'
import { leaderboardService } from '@/lib/services/leaderboard.service'

/**
 * @openapi
 * /api/leaderboard/history/{game}/{category}/{team}:
 *   get:
 *     summary: Busca histórico de cálculos de um time específico
 *     description: Retorna todos os eventos calculados e revertidos para um time
 *     parameters:
 *       - in: path
 *         name: game
 *         required: true
 *       - in: path
 *         name: category
 *         required: true
 *       - in: path
 *         name: team
 *         required: true
 *         description: Código do time
 *     responses:
 *       200:
 *         description: Histórico retornado com sucesso
 *       500:
 *         description: Erro ao buscar histórico
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string; category: string; team: string }> }
) {
  try {
    const { game, category: categoryStr, team: teamStr } = await params
    const category = Number(categoryStr)
    const teamCode = Number(teamStr)

    const history = await leaderboardService.getTeamHistory(game, category, teamCode)

    return NextResponse.json({
      teamCode,
      history
    })
  } catch (error: any) {
    console.error('Error fetching team history:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar histórico do time', details: error.message },
      { status: 500 }
    )
  }
}
