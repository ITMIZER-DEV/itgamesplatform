import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string; category: string }> }
) {
  try {
    const { game, category } = await params
    const points = await prisma.points.findMany({
      where: {
        game,
        category: parseInt(category)
      },
      orderBy: {
        position: 'asc'
      }
    })

    return NextResponse.json(points)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar pontos', details: error.message }, { status: 500 })
  }
}
