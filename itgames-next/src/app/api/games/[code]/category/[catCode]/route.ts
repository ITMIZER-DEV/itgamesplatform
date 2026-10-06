import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

const UpdateCategorySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  standards: z.string().optional(),
  amount: z.number().optional(),
  maxAthlete: z.number().int().optional(),
})

/**
 * @openapi
 * /api/games/{code}/category/{catCode}:
 *   get:
 *     summary: Retorna detalhes de uma categoria em um jogo
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: catCode
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Não encontrado }
 *   patch:
 *     summary: Atualiza uma categoria (Admin)
 *     security: [{ "access-token": [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: catCode
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     summary: Remove uma categoria (Admin)
 *     security: [{ "access-token": [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: catCode
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string, catCode: string }> }
) {
  try {
    const { code: gamesId, catCode } = await params
    const code = Number(catCode)

    const category = await prisma.category.findUnique({
      where: {
        code_gamesId: { code, gamesId }
      },
      include: {
        workouts: true,
        registrations: true
      }
    })

    if (!category) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
    }

    return NextResponse.json(category)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar categoria', details: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string, catCode: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { code: gamesId, catCode } = await params
    const code = Number(catCode)
    
    const body = await request.json()
    const validatedData = UpdateCategorySchema.parse(body)

    const category = await prisma.category.update({
      where: {
        code_gamesId: { code, gamesId }
      },
      data: validatedData
    })

    return NextResponse.json(category)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar categoria', details: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string, catCode: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { code: gamesId, catCode } = await params
    const code = Number(catCode)

    await prisma.category.delete({
      where: {
        code_gamesId: { code, gamesId }
      }
    })

    return NextResponse.json({ success: true, message: 'Categoria removida com sucesso' })
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao remover categoria', details: error.message }, { status: 500 })
  }
}
