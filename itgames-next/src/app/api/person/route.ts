import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { updateFirebaseUser } from '@/lib/firebase-admin'

const PersonSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  cpf: z.string().min(1, 'CPF é obrigatório'),
  email: z.string().email('E-mail inválido'),
  phoneNumber: z.string().optional(),
  uuid: z.string().optional(),
  token: z.string().optional(),
  tenant_id: z.number().int(),
})

/**
 * @openapi
 * /api/person:
 *   get:
 *     summary: Lista pessoas de um tenant
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema: { type: integer }
 *   post:
 *     summary: Cria ou atualiza uma pessoa por CPF (Upsert)
 */
export async function GET(request: Request) {
  const tenantId = Number(request.headers.get('x-tenant-id')) || 1
  
  try {
    const persons = await prisma.person.findMany({
      where: { tenant_id: tenantId },
      select: {
        idPerson: true,
        name: true,
        email: true,
        cpf: true,
        status: true
      }
    })
    return NextResponse.json(persons)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao listar pessoas', details: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = PersonSchema.parse(body)
    const { token, ...prismaData } = validatedData

    // Lógica legado: Upsert por CPF
    const existingPerson = await prisma.person.findUnique({
      where: { cpf: prismaData.cpf }
    })

    let person
    if (existingPerson) {
      person = await prisma.person.update({
        where: { cpf: prismaData.cpf },
        data: {
          name: prismaData.name,
          email: prismaData.email,
          uuid: prismaData.uuid,
          phoneNumber: prismaData.phoneNumber
        }
      })
    } else {
      person = await prisma.person.create({
        data: {
          ...prismaData,
          status: 'new'
        }
      })
    }

    // Sincronização com Firebase se o UUID estiver presente
    if (person.uuid) {
      await updateFirebaseUser(person.tenant_id as number, person.uuid, {
        name: person.name || undefined,
        email: person.email || '',
        cpf: person.cpf || undefined,
        phoneNumber: person.phoneNumber || ''
      })
    }

    return NextResponse.json(person)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao processar pessoa', details: error.message }, { status: 500 })
  }
}
