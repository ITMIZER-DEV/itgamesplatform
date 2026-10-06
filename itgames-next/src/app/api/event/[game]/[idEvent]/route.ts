import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { z } from 'zod'

const UpdateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ game: string; idEvent: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { game, idEvent } = await params
    const eventId = parseInt(idEvent)
    const body = await request.json()
    const data = UpdateEventSchema.parse(body)

    const event = await prisma.event.update({
      where: { idEvent_game: { idEvent: eventId, game } },
      data,
    })

    return NextResponse.json(event)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar evento', details: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ game: string; idEvent: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { game, idEvent } = await params
    const eventId = parseInt(idEvent)

    // Excluir scores do evento antes de deletar o evento
    await prisma.score.deleteMany({ where: { idEvent: eventId, game } })

    await prisma.event.delete({
      where: { idEvent_game: { idEvent: eventId, game } },
    })

    return NextResponse.json({ success: true, message: 'Evento e scores removidos' })
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao excluir evento', details: error.message }, { status: 500 })
  }
}
