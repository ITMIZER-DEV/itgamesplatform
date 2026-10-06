import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * @openapi
 * /api/games/{code}/category:
 *   get:
 *     summary: Lista todas as categorias vinculadas a um jogo
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: gamesId } = await params
    const categories = await prisma.category.findMany({
      where: { gamesId },
      include: {
        workouts: true,
        registrations: true
      }
    })

    return NextResponse.json(categories)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar categorias', details: error.message }, { status: 500 })
  }
}
