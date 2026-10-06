import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string }> }
) {
  try {
    const { game } = await params
    const judges = await prisma.judge.findMany({
      where: {
        game
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(judges)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar juízes', details: error.message }, { status: 500 })
  }
}
