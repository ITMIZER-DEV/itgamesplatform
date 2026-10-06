import { NextResponse } from 'next/server'
import { leaderboardService } from '@/lib/services/leaderboard.service'

/**
 * @openapi
 * /api/leaderboard/preview/{game}/{category}:
 *   get:
 *     summary: Gera preview do leaderboard sem salvar no banco
 *     description: Calcula ranking em memória para revisão antes de confirmar
 *     parameters:
 *       - in: path
 *         name: game
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Preview do leaderboard gerado com sucesso
 *       500:
 *         description: Erro ao gerar preview
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string; category: string }> }
) {
  try {
    const { game, category: categoryStr } = await params
    const category = Number(categoryStr)

    const preview = await leaderboardService.generatePreview(game, category)

    return NextResponse.json(preview)
  } catch (error: any) {
    console.error('Error generating leaderboard preview:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar preview do leaderboard', details: error.message },
      { status: 500 }
    )
  }
}
