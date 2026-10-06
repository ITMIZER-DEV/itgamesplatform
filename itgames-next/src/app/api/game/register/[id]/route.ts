import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

const UpdateRegisterSchema = z.object({
  team: z.string().optional(),
  status: z.string().optional(),
  check: z.boolean().optional(),
  number: z.string().optional(),
  categoryId: z.number().int().optional(),
  athletes: z.array(z.object({
    code: z.number().int(),
    name: z.string(),
    cpf: z.string().optional().nullable(),
    phonenumber: z.string().optional().nullable(),
  })).optional(),
})

/**
 * @openapi
 * /api/game/register/{id}:
 *   get:
 *     summary: Retorna detalhes de uma inscrição específica
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: game
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *   patch:
 *     summary: Atualiza uma inscrição (Admin)
 *     security: [{ "access-token": [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     summary: Remove uma inscrição e seus dependentes em cascata (Admin)
 *     security: [{ "access-token": [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: game
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: regId } = await params
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('game')

    // Se o 'id' passado for um UUID de Jogo (e não um número de inscrição)
    // Então retorna a lista de TODAS as inscrições desse Jogo.
    if (isNaN(Number(regId)) || regId.length > 15) {
      const registrations = await prisma.registration.findMany({
        where: { gameCode: regId },
        include: {
          athletes: true,
          category: {
            include: {
              events: true,
              workouts: true
            }
          }
        }
      })
      return NextResponse.json(registrations)
    }

    // Caso contrário, busca por Single Registration (Tenta por code numérico OU por number string)
    const registration = await prisma.registration.findFirst({
      where: {
        gameCode: gameId || undefined,
        OR: [
          { code: isNaN(Number(regId)) ? -1 : Number(regId) },
          { number: regId }
        ]
      },
      include: {
        athletes: true,
        category: {
          include: {
            events: true,
            workouts: true
          }
        }
      }
    })

    if (!registration) {
      return NextResponse.json({ error: 'Inscrição não encontrada' }, { status: 404 })
    }

    return NextResponse.json(registration)
  } catch (error: any) {
    console.error('Erro no GET de inscrição:', error)
    return NextResponse.json({ error: 'Erro ao buscar inscrição', details: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { id: regId } = await params
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('game')
    const body = await request.json()
    console.log('PATCH registration body:', JSON.stringify(body, null, 2))
    
    const validation = UpdateRegisterSchema.safeParse(body)
    if (!validation.success) {
      console.error('Erro de validação Zod:', validation.error.issues)
      return NextResponse.json({ 
        error: 'Erro de validação', 
        issues: validation.error.issues 
      }, { status: 400 })
    }
    const validatedData = validation.data

    if (!gameId) {
      return NextResponse.json({ error: 'Parâmetro game é necessário para atualizar' }, { status: 400 })
    }

    const { athletes, ...regData } = validatedData

    const registration = await prisma.$transaction(async (tx) => {
      // 1. Atualizar a inscrição
      const updatedReg = await tx.registration.update({
        where: { 
          code_gameCode: { 
            code: Number(regId), 
            gameCode: gameId 
          } 
        },
        data: regData
      })

      // 2. Se a categoria mudou, sincronizar nos atletas
      if (regData.categoryId !== undefined) {
        await tx.athlete.updateMany({
          where: { 
            team: Number(regId),
            game: gameId
          },
          data: {
            category: regData.categoryId
          }
        })
      }

      // 3. Atualizar atletas individualmente se fornecido
      if (athletes && athletes.length > 0) {
        for (const athlete of athletes) {
          await tx.athlete.update({
            where: {
              code_team: {
                code: athlete.code,
                team: Number(regId)
              }
            },
            data: {
              name: athlete.name,
              cpf: athlete.cpf,
              phonenumber: athlete.phonenumber,
              category: regData.categoryId ?? undefined
            }
          })
        }
      }

      return updatedReg
    })

    return NextResponse.json(registration)
  } catch (error: any) {
    console.error('Erro NO PATCH de inscrição (500):', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar inscrição', details: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { id: regId } = await params
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('game')
    
    // Usando deleteMany para permitir deleção baseada em um ou mais campos se gameId não for exato,
    // ou findUnique se tivermos o par de IDs.
    const deleted = await prisma.registration.deleteMany({
      where: gameId
        ? { code: Number(regId), gameCode: gameId }
        : { code: Number(regId) }
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Inscrição não encontrada ou já deletada.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Inscrição removida com sucesso' })
  } catch (error: any) {
    console.error('Erro na deleção de inscrição:', error)
    return NextResponse.json({ error: 'Erro ao remover inscrição', details: error.message }, { status: 500 })
  }
}
