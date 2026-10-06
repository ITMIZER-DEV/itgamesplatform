import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CreateGameSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  date: z.string().or(z.date()).transform((val) => typeof val === 'string' ? val : val.toISOString()),
  description: z.string().optional(),
  location: z.string().optional(),
  Events: z.number().int().default(0),
})

/**
 * @openapi
 * /api/games:
 *   get:
 *     summary: "Lista jogos (públicos: apenas Ativo/New, admin: todos)"
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Se true, inclui jogos inativos/cancelados (apenas admin)
 *     responses:
 *       200:
 *         description: Lista de jogos retornada com sucesso
 *   post:
 *     summary: Cria um novo jogo (Requer Autenticação)
 *     security:
 *       - access-token: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, date, Events]
 *             properties:
 *               name: { type: string }
 *               date: { type: string, format: date }
 *               description: { type: string }
 *               location: { type: string }
 *               Events: { type: integer }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const games = await prisma.game.findMany({
      where: includeInactive ? undefined : {
        OR: [
          { status: 'Ativo' },
          { status: 'New' },
          { status: null }
        ]
      },
      orderBy: {
        date: 'asc'
      }
    })
    return NextResponse.json(games)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao listar jogos', details: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const validatedData = CreateGameSchema.parse(body)

    const game = await prisma.game.create({
      data: {
        code: validatedData.code || crypto.randomUUID(),
        name: validatedData.name,
        date: validatedData.date,
        description: validatedData.description,
        location: validatedData.location,
        Events: validatedData.Events,
        status: 'New',
        foto: ''
      }
    })

    return NextResponse.json(game, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao criar jogo', details: error.message }, { status: 500 })
  }
}
