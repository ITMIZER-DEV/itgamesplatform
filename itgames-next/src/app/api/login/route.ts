import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email(),
  token: z.string().optional()
})

/**
 * @openapi
 * /api/login:
 *   post:
 *     summary: Valida o usuário no inquilino (tenant) com base no email (Legacy compatibility)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 */
export async function POST(request: Request) {
  try {
    const tenantId = Number(request.headers.get('x-tenant-id')) || 1
    const body = await request.json()
    const { email } = LoginSchema.parse(body)

    // 1. Tentar encontrar o e-mail na tabela User (Identidade Digital)
    const userAccount = await prisma.user.findFirst({
      where: {
        email,
        status: 'active'
      },
      include: {
        person: true
      }
    })

    if (userAccount) {
      console.log(`[Login] Usuário encontrado na tabela User. Role: ${userAccount.role}`)
      
      // Atualiza o token se fornecido
      if (body.token) {
        await prisma.user.update({
          where: { id: userAccount.id },
          data: { token: body.token }
        })
      }

      return NextResponse.json({
        idPerson: userAccount.personId,
        role: userAccount.role
      })
    }

    // 2. Fallback: Tentar encontrar na tabela Person (Legado/Atletas)
    const person = await prisma.person.findFirst({
      where: {
        email,
        tenant_id: tenantId
      },
      include: {
        users: true,
        client: true
      }
    })

    if (!person) {
      return NextResponse.json(
        { message: `E-mail: ${email} não consta em nossa base de dados para esta empresa. Deseja realizar cadastro?` }
      )
    }

    // Resolve a role para legado: Atletas (Client)
    let role = 'GUEST'
    if (person.client) {
      role = 'ATHLETE'
    }

    return NextResponse.json({
      idPerson: person.idPerson,
      role: role
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno no servidor', details: error.message }, { status: 500 })
  }
}
