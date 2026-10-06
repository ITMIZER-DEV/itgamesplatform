import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * @openapi
 * /api/leaderboard/{game}/{category}:
 *   get:
 *     summary: Retorna o ranking geral (Leaderboard) de uma categoria em um jogo
 *     parameters:
 *       - in: path
 *         name: game
 *       - in: path
 *         name: category
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string, category: string }> }
) {
  try {
    const { game, category: categoryStr } = await params
    const categoryId = Number(categoryStr)

    // 1. Buscar configuração do game para saber a ordem de pontuação
    const gameData = await prisma.game.findUnique({
      where: { code: game },
      select: { isLowestPointsBetter: true }
    })

    const isLowest = gameData?.isLowestPointsBetter ?? false
    const order = isLowest ? 'asc' : 'desc'

    const results = await prisma.leaderboard.findMany({
      where: {
        game,
        category: categoryId
      },
      include: {
        registration: {
          select: {
            team: true,
            athletes: { select: { name: true } },
            scores: {
              where: { status: true },
              select: {
                weight: true,
                time: true,
                reps: true,
                point: true,
                rank: true,
                eventRef: { select: { title: true } }
              }
            }
          }
        }
      },
      orderBy: {
        points: order
      }
    })

    if (results.length === 0) {
      return NextResponse.json({ error: 'Leaderboard não disponível ou sem dados' }, { status: 202 })
    }

    // Adiciona o Rank (Dense Rank)
    let currentRank = 1
    let previousPoints = results[0].points

    const resultsWithRank = results.map((result) => {
      if (result.points !== previousPoints) {
        currentRank++
      }
      previousPoints = result.points
      return { ...result, Rank: currentRank }
    })

    return NextResponse.json(resultsWithRank)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar leaderboard', details: error.message }, { status: 500 })
  }
}
