import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

const UpdatePersonSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  cpf: z.string().optional(),
  phoneNumber: z.string().optional(),
  foto: z.string().optional(),
  dataNascimento: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  tenant_id: z.number().int().optional(),
  token: z.string().optional(),
})

/**
 * @openapi
 * /api/person/{id}:
 *   get:
 *     summary: Retorna detalhes de uma pessoa específica
 *   patch:
 *     summary: Atualiza dados de uma pessoa (Admin)
 *   post:
 *     summary: Atualiza dados de uma pessoa (Legacy compatibility)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idPerson } = await params
    const person = await prisma.person.findUnique({
      where: { idPerson }
    })

    if (!person) {
      return NextResponse.json({ error: 'Pessoa não encontrada' }, { status: 404 })
    }

    return NextResponse.json(person)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar pessoa', details: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { id: idPerson } = await params
    const body = await request.json()
    const validatedData = UpdatePersonSchema.parse(body)

    const updatedPerson = await prisma.person.update({
      where: { idPerson },
      data: validatedData
    })

    return NextResponse.json(updatedPerson)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar pessoa', details: error.message }, { status: 500 })
  }
}

// Mantendo POST para compatibilidade com legados que usam POST para update
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(request, { params })
}
