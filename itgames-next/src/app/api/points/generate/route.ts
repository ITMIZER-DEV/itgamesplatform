import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

const GeneratePointsSchema = z.object({
  game: z.string().min(1),
  maxPosition: z.number().int().default(25),
})

/**
 * @openapi
 * /api/points/generate:
 *   post:
 *     summary: Gera automaticamente a tabela de pontuação por posição para um jogo
 *     security: [{ "access-token": [] }]
 */
export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const { game, maxPosition } = GeneratePointsSchema.parse(body)

    const categories = await prisma.category.findMany({
      where: { gamesId: game }
    })

    const pointsToInsert: any[] = []
    
    for (const category of categories) {
      const increment = (100 - 4) / (maxPosition - 1)
      let currentPoints = 100

      for (let position = 1; position <= maxPosition; position++) {
        pointsToInsert.push({
          game,
          category: category.code,
          position,
          points: Math.round(currentPoints)
        })
        currentPoints -= increment
      }
    }

    await prisma.points.createMany({
      data: pointsToInsert,
      skipDuplicates: true
    })

    return NextResponse.json({ success: true, count: pointsToInsert.length })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao gerar pontos', details: error.message }, { status: 500 })
  }
}
