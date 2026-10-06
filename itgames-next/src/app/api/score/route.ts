import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CreateScoreSchema = z.object({
  game: z.string().min(1),
  category: z.number().int(),
  idEvent: z.number().int(),
  codeTeam: z.number().int(),
  numberTeam: z.string(),
  judge: z.string(),
  reps: z.string().optional().nullable(),
  weight: z.string().optional().nullable(),
  time: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
})

/**
 * @openapi
 * /api/score:
 *   post:
 *     summary: Registra o score de um time em um evento
 *     security: [{ "access-token": [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [game, category, idEvent, codeTeam, numberTeam, judge]
 */
export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const validatedData = CreateScoreSchema.parse(body)

    // Verifica se já existe score para este time no evento
    const existingScore = await prisma.score.findFirst({
      where: {
        game: validatedData.game,
        category: validatedData.category,
        idEvent: validatedData.idEvent,
        codeTeam: validatedData.codeTeam
      }
    })

    if (existingScore) {
      return NextResponse.json(
        { error: `Time ${validatedData.numberTeam} já possui score registrado para este evento.` },
        { status: 202 }
      )
    }

    // Busca o último ID manualmente para evitar erro de autoincrement se a migração não tiver rodado
    const lastScore = await prisma.score.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true }
    })
    const nextCode = (lastScore?.code || 0) + 1

    const score = await prisma.score.create({
      data: {
        code: nextCode,
        game: validatedData.game,
        category: validatedData.category,
        idEvent: validatedData.idEvent,
        codeTeam: validatedData.codeTeam,
        numberTeam: validatedData.numberTeam,
        judge: validatedData.judge,
        reps: validatedData.reps,
        weight: validatedData.weight,
        time: validatedData.time,
        photo: validatedData.photo,
        status: false // Pendente de rankeamento
      }
    })

    return NextResponse.json(score, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao registrar score', details: error.message }, { status: 500 })
  }
}
