import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

const CreateCategorySchema = z.object({
  gamesId: z.string().min(1, 'ID do jogo é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  amount: z.number().default(0),
  description: z.string().optional(),
  standards: z.string().optional(),
})

/**
 * @openapi
 * /api/category:
 *   post:
 *     summary: Cria uma nova categoria para um jogo
 *     security: [{ "access-token": [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gamesId, name]
 */
export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const validatedData = CreateCategorySchema.parse(body)

    // Lógica herdada do backend original para calcular o próximo código
    const maxCategoria = await prisma.category.aggregate({
      _max: {
        code: true,
      },
      where: {
        gamesId: validatedData.gamesId,
      },
    })

    const novoCodigoCategoria = (maxCategoria._max.code || 0) + 1

    const category = await prisma.category.create({
      data: {
        code: novoCodigoCategoria,
        ...validatedData,
        foto: ''
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao criar categoria', details: error.message }, { status: 500 })
  }
}
