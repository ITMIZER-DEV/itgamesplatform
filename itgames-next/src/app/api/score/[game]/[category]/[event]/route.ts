import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * @openapi
 * /api/score/{game}/{category}/{event}:
 *   get:
 *     summary: Lista scores de um evento com rank calculado na hora
 *     parameters:
 *       - in: path
 *         name: game
 *       - in: path
 *         name: category
 *       - in: path
 *         name: event
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string, category: string, event: string }> }
) {
  try {
    const { game, category: categoryStr, event: eventStr } = await params
    const categoryId = Number(categoryStr)
    const idEvent = Number(eventStr)

    // Busca o tipo do workout para decidir a ordenação
    const event = await prisma.event.findFirst({
      where: { idEvent, game },
      include: { 
        categoryRef: {
          include: {
            workouts: {
              where: { code: { not: undefined } } // simplificado
            }
          }
        }
      }
    })

    // Como os workouts estão ligados à categoria, buscamos o tipo específico do workout deste evento
    const workout = await prisma.workout.findFirst({
      where: { 
        code: event?.workout || 0,
        game: game
      }
    })

    const isTimeType = workout?.type === 'time'

    const scoresRaw = await prisma.score.findMany({
      where: {
        game,
        category: categoryId,
        idEvent
      },
      include: {
        registration: {
          select: {
            team: true,
            status: true,
            number: true,
            athletes: {
              select: { name: true, cpf: true }
            }
          }
        }
      }
    })

    // Ordenação manual em memória para garantir tratamento numérico correto
    const scores = [...scoresRaw].sort((a, b) => {
      if (isTimeType) {
        // 1. Tempo (ASC)
        if (a.time !== b.time) return (a.time || '').localeCompare(b.time || '')
        // 2. Repetições Faltantes (ASC numérico) - Menos faltante é melhor
        return Number(a.reps || 0) - Number(b.reps || 0)
      } else {
        // 1. Carga (DESC numérico)
        const weightA = Number(a.weight || 0)
        const weightB = Number(b.weight || 0)
        if (weightA !== weightB) return weightB - weightA

        // 2. Reps (DESC numérico - AMRAP)
        const repsA = Number(a.reps || 0)
        const repsB = Number(b.reps || 0)
        if (repsA !== repsB) return repsB - repsA

        // 3. Tempo (ASC - Tiebreak para AMRAP/Carga se houver tempo registrado)
        return (a.time || '').localeCompare(b.time || '')
      }
    })

    // Adiciona posição com tratamento de empate (Rank Dinâmico)
    let currentPosition = 1
    let previousScore: any = null
    let currentRank = 1

    const resultWithRank = scores.map((score) => {
      const isTie = previousScore && 
        score.time === previousScore.time && 
        Number(score.weight || 0) === Number(previousScore.weight || 0) &&
        Number(score.reps || 0) === Number(previousScore.reps || 0)

      if (!isTie) {
        currentRank = currentPosition
      }

      previousScore = score
      currentPosition++
      return { ...score, rank: currentRank }
    })

    return NextResponse.json(resultWithRank)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar scores', details: error.message }, { status: 500 })
  }
}
