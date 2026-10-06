import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * @openapi
 * /api/events/{game}/{category}:
 *   get:
 *     summary: Lista eventos de uma categoria específica em um jogo
 *     parameters:
 *       - in: path
 *         name: game
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: integer }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string, category: string }> }
) {
  try {
    const { game, category } = await params
    const categoryCode = Number(category)

    const events = await prisma.event.findMany({
      where: {
        game,
        category: categoryCode
      },
      orderBy: {
        title: 'asc'
      }
    })

    return NextResponse.json(events)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar eventos', details: error.message }, { status: 500 })
  }
}
