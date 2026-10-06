import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

const UpdateGameSchema = z.object({
  name: z.string().optional(),
  date: z.string().or(z.date()).transform((val) => typeof val === 'string' ? val : val.toISOString()).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  Events: z.number().int().optional(),
  status: z.string().optional(),
  foto: z.string().optional(),
  isLowestPointsBetter: z.boolean().optional(),
  showTime: z.boolean().optional(),
  showWeight: z.boolean().optional(),
  showReps: z.boolean().optional(),
  showScoreRevision: z.boolean().optional(),
})

/**
 * @openapi
 * /api/games/{code}:
 *   get:
 *     summary: Retorna detalhes de um jogo específico
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Não encontrado }
 *   patch:
 *     summary: Atualiza dados de um jogo (Admin)
 *     security: [{ "access-token": [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Atualizado }
 *       401: { description: Não autorizado }
 *   delete:
 *     summary: Remove um jogo (Admin)
 *     security: [{ "access-token": [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Removido }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const game = await prisma.game.findUnique({
      where: { code },
      include: {
        categories: {
          include: {
            workouts: true,
            events: true
          }
        }
      }
    })

    if (!game) {
      return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
    }

    return NextResponse.json(game)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar jogo', details: error.message }, { status: 500 })
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
    const body = await request.json()
    const validatedData = UpdateGameSchema.parse(body)

    const game = await prisma.game.update({
      where: { code },
      data: validatedData
    })

    return NextResponse.json(game)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar jogo', details: error.message }, { status: 500 })
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
    await prisma.game.delete({
      where: { code }
    })

    return NextResponse.json({ success: true, message: 'Jogo removido com sucesso' })
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao remover jogo', details: error.message }, { status: 500 })
  }
}
