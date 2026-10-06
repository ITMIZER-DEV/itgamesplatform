import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { z } from 'zod'

const PointsSchema = z.array(z.object({
  game: z.string(),
  category: z.number().int(),
  position: z.number().int(),
  points: z.number().int(),
}))

export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const data = PointsSchema.parse(body)

    // Otimização: Em vez de muitos upserts (lento), deletamos e criamos em massa (rápido)
    // Usamos Transação Interativa para poder definir um timeout maior (10s)
    await prisma.$transaction(async (tx) => {
      await tx.points.deleteMany({
        where: {
          game: data[0].game,
          category: data[0].category
        }
      })
      
      await tx.points.createMany({
        data: data
      })
    }, {
      timeout: 10000 
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao salvar pontos', details: error.message }, { status: 500 })
  }
}
