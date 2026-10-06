import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string }> }
) {
  try {
    const { game } = await params
    const workouts = await prisma.workout.findMany({
      where: {
        game
      },
      include: {
        categoryRef: true
      },
      orderBy: {
        code: 'asc'
      }
    })

    // Mapeia para manter compatibilidade com o frontend (Category em vez de categoryRef)
    const formattedWorkouts = workouts.map(w => ({
      ...w,
      Category: w.categoryRef
    }))

    return NextResponse.json(formattedWorkouts)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar workouts', details: error.message }, { status: 500 })
  }
}
