import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const scoreId = parseInt(code)

    if (isNaN(scoreId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const score = await prisma.score.findUnique({
      where: { code: scoreId },
      include: {
        registration: {
          include: {
            athletes: true
          }
        },
        eventRef: true
      }
    })

    if (!score) {
      return NextResponse.json({ error: 'Score não encontrado' }, { status: 404 })
    }

    return NextResponse.json(score)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar score', details: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { code } = await params
    const scoreId = parseInt(code)

    if (isNaN(scoreId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    await prisma.score.delete({
      where: { code: scoreId }
    })

    return NextResponse.json({ success: true, message: 'Score removido com sucesso' })
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao remover score', details: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { code } = await params
    const scoreId = parseInt(code)
    const body = await request.json()

    if (isNaN(scoreId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    // Campos permitidos para atualização
    const { time, reps, weight, point, isWO } = body

    const updatedScore = await prisma.score.update({
      where: { code: scoreId },
      data: {
        time: time !== undefined ? time : undefined,
        reps: reps !== undefined ? reps : undefined,
        weight: weight !== undefined ? weight : undefined,
        point: point !== undefined ? Number(point) : undefined,
        isWO: isWO !== undefined ? Boolean(isWO) : undefined
      }
    })

    return NextResponse.json({ success: true, score: updatedScore })
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao atualizar score', details: error.message }, { status: 500 })
  }
}
