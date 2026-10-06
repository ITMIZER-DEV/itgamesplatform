import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * @openapi
 * /api/leaderboard/parciais/{game}/{category}:
 *   get:
 *     summary: Retorna dados parciais de todos os eventos calculados
 *     description: Mostra todas as colocações e resultados por evento para análise
 *     parameters:
 *       - in: path
 *         name: game
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dados parciais retornados com sucesso
 *       500:
 *         description: Erro ao buscar dados parciais
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ game: string; category: string }> }
) {
  try {
    const { game, category: categoryStr } = await params
    const category = Number(categoryStr)

    // Buscar todos os times inscritos nessa categoria
    const registrations = await prisma.registration.findMany({
      where: {
        gameCode: game,
        categoryId: category
      },
      include: {
        athletes: true
      },
      orderBy: { code: 'asc' }
    })

    if (registrations.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Nenhum time inscrito nesta categoria'
      })
    }

    // Buscar todos os eventos da categoria
    const events = await prisma.event.findMany({
      where: { game, category },
      orderBy: { idEvent: 'asc' }
    })

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Nenhum evento criado para esta categoria'
      })
    }

    // Buscar workouts para pegar o tipo (time/weight/reps)
    const workoutIds = events.map(e => e.workout).filter((id): id is number => id !== null)
    const workouts = await prisma.workout.findMany({
      where: {
        code: { in: workoutIds }
      }
    })
    const workoutMap = new Map(workouts.map(w => [w.code, w]))

    // Buscar todos os scores (incluindo os sem rank)
    const scores = await prisma.score.findMany({
      where: {
        game,
        category
      },
      include: {
        eventRef: true
      },
      orderBy: [
        { codeTeam: 'asc' },
        { idEvent: 'asc' }
      ]
    })

    // Agrupar scores por time e evento
    const scoresByTeamAndEvent = new Map<string, any>()
    scores.forEach(score => {
      const key = `${score.codeTeam}-${score.idEvent}`
      scoresByTeamAndEvent.set(key, score)
    })

    // Montar resultado formatado
    const formatResult = (score: any) => {
      if (!score) return '-'
      if (score.isWO) return 'WO'

      const parts = []
      if (score.time) parts.push(score.time)
      if (score.reps && score.time) parts.push(`${score.reps} reps`)
      else if (score.reps) parts.push(`${score.reps} reps`)
      if (score.weight) parts.push(`${score.weight}kg`)

      return parts.length > 0 ? parts.join(' + ') : '-'
    }

    // Montar dados completos
    const parciaisData = registrations.map((reg, index) => {
      // Buscar scores desse time para todos os eventos
      const teamEvents = events.map(event => {
        const key = `${reg.code}-${event.idEvent}`
        const score = scoresByTeamAndEvent.get(key)
        const workout = event.workout ? workoutMap.get(event.workout) : null

        return {
          eventId: event.idEvent,
          eventTitle: event.title,
          eventType: workout?.type || 'N/A',
          rank: score?.rank || null,
          points: score?.point || 0,
          result: formatResult(score),
          time: score?.time || null,
          weight: score?.weight || null,
          reps: score?.reps || null,
          isWO: score?.isWO || false,
          hasScore: !!score
        }
      })

      // Calcular total de pontos
      const totalPoints = teamEvents.reduce((sum, e) => sum + (e.points || 0), 0)

      return {
        position: index + 1, // Posição temporária baseada na ordem de inscrição
        teamCode: reg.code,
        teamName: reg.team,
        teamNumber: reg.number,
        athletes: reg.athletes.map((a: any) => a.name),
        totalPoints,
        events: teamEvents
      }
    })

    // Ordenar por total de pontos (maior para menor)
    parciaisData.sort((a, b) => b.totalPoints - a.totalPoints)

    // Atualizar posições após ordenação
    parciaisData.forEach((team, index) => {
      team.position = index + 1
    })

    return NextResponse.json({
      success: true,
      data: parciaisData
    })
  } catch (error: any) {
    console.error('Error fetching parciais data:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao buscar dados parciais',
        details: error.message
      },
      { status: 500 }
    )
  }
}
