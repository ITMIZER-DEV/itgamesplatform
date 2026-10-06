import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { z } from 'zod'

const CreateWorkoutSchema = z.object({
  game: z.string().min(1, 'ID do jogo é obrigatório'),
  category: z.coerce.number().int(),
  type: z.string().optional(),
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  timeCap: z.string().optional(),
  foto: z.string().optional(),
})

export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const validatedData = CreateWorkoutSchema.parse(body)

    // Lógica para obter o próximo código sequencial para este jogo
    const maxWorkout = await prisma.workout.aggregate({
      _max: {
        code: true
      },
      where: {
        game: validatedData.game
      }
    })

    const nextCode = (maxWorkout._max.code || 0) + 1

    const workout = await prisma.workout.create({
      data: {
        code: nextCode,
        ...validatedData,
        status: true
      }
    })

    return NextResponse.json(workout, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao criar workout', details: error.message }, { status: 500 })
  }
}
