import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

/**
 * @openapi
 * /api/events/closed/{idEvent}/{category}:
 *   post:
 *     summary: Fecha um evento e atualiza o leaderboard (Subtrai pontos)
 *     parameters:
 *       - in: path
 *         name: idEvent
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: integer }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ idEvent: string, category: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { idEvent: eventIdStr, category: categoryStr } = await params
    const idEvent = Number(eventIdStr)
    const category = Number(categoryStr)

    const scores = await prisma.score.findMany({
      where: { idEvent, category }
    })

    await prisma.$transaction(async (tx) => {
      for (const score of scores) {
        const { codeTeam, point } = score
        if (!point) continue

        // Busca registro no leaderboard
        const leaderboard = await tx.leaderboard.findFirst({
          where: {
            category,
            game: score.game,
            teamCode: codeTeam
          }
        })

        if (leaderboard) {
          const newPoints = (Number(leaderboard.points) || 0) - (Number(point) || 0)

          if (newPoints <= 0) {
            await tx.leaderboard.delete({
              where: { id: leaderboard.id }
            })
          } else {
            await tx.leaderboard.update({
              where: { id: leaderboard.id },
              data: { points: newPoints }
            })
          }
        }
      }

      // Atualiza o status do evento
      // Como o evento tem PK composta [idEvent, game], precisamos do game.
      // Pegamos o game do primeiro score encontrado ou falhamos se não houver scores.
      const gameCode = scores[0]?.game;
      if (gameCode) {
        await tx.event.update({
          where: { idEvent_game: { idEvent, game: gameCode } },
          data: { status: false }
        })
      }
    })

    return NextResponse.json({ success: true, message: 'Evento fechado e leaderboard atualizado com sucesso' })
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao fechar evento', details: error.message }, { status: 500 })
  }
}

// Mantendo GET para compatibilidade se o frontend chamar via link
export async function GET(
  request: Request,
  { params }: { params: Promise<{ idEvent: string, category: string }> }
) {
  return POST(request, { params })
}
