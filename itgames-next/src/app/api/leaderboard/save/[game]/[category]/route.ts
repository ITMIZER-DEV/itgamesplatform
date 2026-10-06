import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = {
  params: Promise<{ game: string; category: string }>
}

/**
 * POST /api/leaderboard/save/[game]/[category]
 * Grava o leaderboard oficial no banco de dados
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { game, category } = await context.params
    const body = await request.json()
    const { teams, executedBy } = body

    if (!teams || !Array.isArray(teams)) {
      return NextResponse.json(
        { success: false, error: 'Dados de times inválidos' },
        { status: 400 }
      )
    }

    const categoryNum = parseInt(category)
    if (isNaN(categoryNum)) {
      return NextResponse.json(
        { success: false, error: 'Categoria inválida' },
        { status: 400 }
      )
    }

    // Salvar leaderboard usando transação
    const result = await prisma.$transaction(async (tx) => {
      let teamsAffected = 0

      for (const team of teams) {
        const { teamCode, totalPoints, position } = team

        // Verificar se já existe entrada para este time
        const existing = await tx.leaderboard.findFirst({
          where: {
            game,
            category: categoryNum,
            teamCode
          }
        })

        if (existing) {
          // Atualizar entrada existente
          await tx.leaderboard.update({
            where: { id: existing.id },
            data: {
              points: totalPoints,
              position: position
            }
          })
        } else {
          // Criar nova entrada
          await tx.leaderboard.create({
            data: {
              game,
              category: categoryNum,
              teamCode,
              points: totalPoints,
              position: position
            }
          })
        }

        teamsAffected++
      }

      // Registrar operação no histórico
      await tx.eventCalculation.create({
        data: {
          game,
          category: categoryNum,
          eventId: 0, // 0 indica gravação completa do leaderboard
          operation: 'SAVE_LEADERBOARD',
          executedBy: executedBy || 'admin',
          affectedTeams: teamsAffected
        }
      })

      return { teamsAffected }
    }, {
      timeout: 60000 // 60 segundos
    })

    return NextResponse.json({
      success: true,
      message: 'Leaderboard gravado com sucesso',
      teamsAffected: result.teamsAffected
    })

  } catch (error) {
    console.error('❌ Error saving leaderboard:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao gravar leaderboard'
      },
      { status: 500 }
    )
  }
}
