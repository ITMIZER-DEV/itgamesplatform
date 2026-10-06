import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { z } from 'zod'

const UpdateWorkoutSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  timeCap: z.string().optional(),
  status: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ game: string; code: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { game, code } = await params
    const wodCode = parseInt(code)
    const body = await request.json()
    const data = UpdateWorkoutSchema.parse(body)

    const workout = await prisma.workout.update({
      where: { code_game: { code: wodCode, game } },
      data,
    })

    // Atualizar eventos vinculados a este workout (campo workout = wodCode)
    if (data.title) {
      await prisma.event.updateMany({
        where: { workout: wodCode, game },
        data: { title: data.title },
      })
    }

    return NextResponse.json(workout)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar workout', details: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ game: string; code: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { game, code } = await params
    const wodCode = parseInt(code)

    console.log(`[DELETE workout] game=${game} code=${wodCode}`)

    // Buscar eventos vinculados para remover scores antes de deletar
    const linkedEvents = await prisma.event.findMany({
      where: { workout: wodCode, game },
      select: { idEvent: true },
    })

    console.log(`[DELETE workout] linked events: ${JSON.stringify(linkedEvents)}`)

    // Excluir scores dos eventos
    for (const evt of linkedEvents) {
      await prisma.score.deleteMany({ where: { idEvent: evt.idEvent, game } })
    }

    // Excluir eventos vinculados
    await prisma.event.deleteMany({ where: { workout: wodCode, game } })

    // Excluir o workout (deleteMany não falha se registro já foi removido por cascade)
    await prisma.workout.deleteMany({ where: { code: wodCode, game } })

    return NextResponse.json({ success: true, message: 'Workout e eventos relacionados removidos' })
  } catch (error: any) {
    console.error('[DELETE workout] error:', error)
    return NextResponse.json({ error: 'Erro ao excluir workout', details: error.message, code: error.code }, { status: 500 })
  }
}
